-- Map exploration uses the existing staff roll / resolution / inventory workflow.
-- No automatic payouts and no changes to the legacy follower weekly allowance.
begin;

alter table public.exploration_locations
  add column if not exists map_label text,
  add column if not exists self_character_ids integer[] not null default '{}';
create unique index if not exists exploration_locations_map_label
  on public.exploration_locations(map_label) where map_label is not null;

create table if not exists public.exploration_settings (
  id boolean primary key default true check (id),
  round_number integer not null default 1 check (round_number > 0)
);
insert into public.exploration_settings(id) values (true) on conflict (id) do nothing;
alter table public.exploration_settings enable row level security;
drop policy if exists "Read exploration round" on public.exploration_settings;
create policy "Read exploration round" on public.exploration_settings
  for select to anon, authenticated using (true);
drop policy if exists "Staff update exploration round" on public.exploration_settings;
create policy "Staff update exploration round" on public.exploration_settings
  for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff());
grant select on public.exploration_settings to anon, authenticated;
grant update on public.exploration_settings to authenticated;

alter table public.follower_explorations
  alter column follower_id drop not null,
  add column if not exists exploration_round integer,
  add column if not exists request_id uuid;
create unique index if not exists exploration_request_id on public.follower_explorations(request_id);
create unique index if not exists self_exploration_one_active
  on public.follower_explorations(character_id) where follower_id is null and status = 'exploring';
create unique index if not exists self_exploration_one_per_round
  on public.follower_explorations(character_id, exploration_round)
  where follower_id is null and status <> 'cancelled';

create or replace function public.get_player_exploration_map(p_character_id integer)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(
    (to_jsonb(l) - 'self_character_ids') || jsonb_build_object('can_explore_self',
      p_character_id = any(l.self_character_ids)
      and not exists (select 1 from public.follower_explorations m
        where m.character_id = p_character_id and m.follower_id is null
          and m.status <> 'cancelled'
          and (m.status = 'exploring' or m.exploration_round = s.round_number)))
    order by l.sort_order), '[]'::jsonb)
  from public.exploration_locations l cross join public.exploration_settings s
  where l.active;
$$;

create or replace function public.start_map_exploration(
  p_character_id integer, p_location_id bigint, p_request_id uuid,
  p_follower_id bigint default null
)
returns public.follower_explorations
language plpgsql security definer set search_path = public as $$
declare
  place public.exploration_locations;
  person public.follower_master;
  mission public.follower_explorations;
  current_round integer;
begin
  if p_request_id is null then raise exception 'Request id required'; end if;
  -- Serializes starts for this character, including retries from multiple tabs.
  perform 1 from public.characters where id = p_character_id for update;
  if not found then raise exception 'Character not available'; end if;
  select * into mission from public.follower_explorations where request_id = p_request_id;
  if found then
    if mission.character_id <> p_character_id or mission.location_id <> p_location_id
      or mission.follower_id is distinct from p_follower_id then
      raise exception 'Request does not match original exploration';
    end if;
    mission.result_details := null;
    return mission;
  end if;

  select * into place from public.exploration_locations where id = p_location_id and active for share;
  if not found then raise exception 'Exploration location not available'; end if;

  if p_follower_id is not null then
    select * into person from public.follower_master where id = p_follower_id for update;
    if not found or not person.active or person.owner_character_id is distinct from p_character_id then
      raise exception 'Follower not available';
    end if;
    -- The established RPC enforces access, idle status, talents and weekly limit.
    mission := public.start_follower_exploration(p_character_id, p_follower_id, p_location_id, 'สำรวจและจัดหาของใช้');
    update public.follower_explorations set request_id = p_request_id where id = mission.id returning * into mission;
    mission.result_details := null;
    return mission;
  end if;

  if not (p_character_id = any(place.self_character_ids)) then raise exception 'Location access required'; end if;
  select round_number into current_round from public.exploration_settings where id for share;
  if current_round is null then raise exception 'Exploration round not available'; end if;
  if exists (select 1 from public.follower_explorations where character_id = p_character_id
      and follower_id is null and status = 'exploring') then raise exception 'An active exploration already exists'; end if;
  if exists (select 1 from public.follower_explorations where character_id = p_character_id
      and follower_id is null and exploration_round = current_round and status <> 'cancelled') then
    raise exception 'Exploration round limit reached';
  end if;
  insert into public.follower_explorations(character_id, follower_id, location_id, destination,
    objective, suitability_percent, exploration_round, request_id)
  values (p_character_id, null, place.id, place.name, 'สำรวจและจัดหาของใช้', 0, current_round, p_request_id)
  returning * into mission;
  insert into public.character_history(character_id, action, value, type)
    values(p_character_id, 'ออกสำรวจด้วยตัวเอง', place.name, 'follower_mission');
  return mission;
end;
$$;

-- Guard the existing resolver too: it remains the only way to issue rewards.
create or replace function public.validate_map_exploration_resolution()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'completed' and old.status = 'exploring' and new.request_id is not null then
    if new.reward_item_id is not null and new.resolution_outcome not in ('success', 'critical_success') then
      raise exception 'Failed exploration cannot grant a reward';
    end if;
    if new.reward_quantity > 1 then raise exception 'Map exploration grants at most one item'; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists validate_map_exploration_resolution on public.follower_explorations;
create trigger validate_map_exploration_resolution before update of status on public.follower_explorations
  for each row execute function public.validate_map_exploration_resolution();

create or replace function public.resolve_follower_exploration(
  p_mission_id bigint,
  p_result_summary text,
  p_result_details text default null,
  p_reward_item_id bigint default null,
  p_reward_quantity integer default 0
)
returns public.follower_explorations
language plpgsql
security definer
set search_path = public
as $$
declare
  mission_row public.follower_explorations;
  follower_row public.follower_master;
  reward_item public.items;
  reward_text text := '';
begin
  if not public.is_active_staff() then
    raise exception 'Staff access required';
  end if;

  if nullif(trim(p_result_summary), '') is null then
    raise exception 'Result summary is required';
  end if;

  if p_reward_quantity < 0
    or (p_reward_item_id is null and p_reward_quantity > 0)
    or (p_reward_item_id is not null and p_reward_quantity <= 0) then
    raise exception 'Invalid reward quantity';
  end if;

  select * into mission_row
  from public.follower_explorations
  where id = p_mission_id
  for update;

  if not found or mission_row.status <> 'exploring' then
    raise exception 'Active exploration not found';
  end if;

  select * into follower_row
  from public.follower_master
  where id = mission_row.follower_id
  for update;

  if p_reward_item_id is not null then
    select * into reward_item
    from public.items
    where id = p_reward_item_id and active
    for update;

    if not found then
      raise exception 'Active reward item not found';
    end if;

    if reward_item.is_limited then
      if reward_item.stock_quantity < p_reward_quantity then
        raise exception 'Insufficient reward stock';
      end if;

      update public.items
      set
        stock_quantity = stock_quantity - p_reward_quantity,
        updated_at = now()
      where id = reward_item.id;
    end if;

    insert into public.character_inventory (
      character_id,
      item_name,
      quantity
    )
    values (
      mission_row.character_id,
      reward_item.name,
      p_reward_quantity
    )
    on conflict (character_id, item_name)
    do update set quantity =
      public.character_inventory.quantity + excluded.quantity;

    insert into public.inventory_transactions (
      item_id,
      character_id,
      quantity_change,
      transaction_type,
      note,
      created_by
    )
    values (
      reward_item.id,
      mission_row.character_id,
      -p_reward_quantity,
      'grant',
      'รางวัลจากภารกิจผู้ติดตาม: ' || trim(p_result_summary),
      auth.uid()
    );

    reward_text := ' · ได้รับ ' || reward_item.name ||
      ' ×' || p_reward_quantity;
  end if;

  update public.follower_explorations
  set
    status = 'completed',
    result_summary = trim(p_result_summary),
    result_details = nullif(trim(p_result_details), ''),
    reward_item_id = p_reward_item_id,
    reward_quantity = p_reward_quantity,
    completed_at = now(),
    resolved_by = auth.uid()
  where id = p_mission_id
  returning * into mission_row;

  update public.follower_master
  set status = 'idle', updated_at = now()
  where id = mission_row.follower_id;

  insert into public.character_history (
    character_id,
    action,
    value,
    type
  )
  values (
    mission_row.character_id,
    coalesce(follower_row.name, (select character_name from public.characters where id = mission_row.character_id)) || ' กลับจากสำรวจ',
    trim(p_result_summary) || reward_text,
    'follower_result'
  );

  return mission_row;
end;
$$;


revoke all on function public.get_player_exploration_map(integer) from public;
revoke all on function public.start_map_exploration(integer, bigint, uuid, bigint) from public;
grant execute on function public.get_player_exploration_map(integer) to anon, authenticated;
grant execute on function public.start_map_exploration(integer, bigint, uuid, bigint) to anon, authenticated;

-- Staff notes must not be included in the player response.
-- Deployed versions may have different OUT columns. Replace atomically, without CASCADE.
drop function if exists public.get_player_follower_explorations(integer);
create or replace function public.get_player_follower_explorations(
  p_character_id integer
)
returns table (
  id bigint,
  follower_id bigint,
  destination text,
  objective text,
  status text,
  result_summary text,
  result_details text,
  reward_item_name text,
  reward_quantity integer,
  started_at timestamptz,
  completed_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    mission.id,
    mission.follower_id,
    mission.destination,
    mission.objective,
    mission.status,
    mission.result_summary,
    null::text,
    reward.name,
    mission.reward_quantity,
    mission.started_at,
    mission.completed_at
  from public.follower_explorations mission
  left join public.items reward on reward.id = mission.reward_item_id
  where mission.character_id = p_character_id
  order by mission.started_at desc
  limit 30;
$$;


revoke all on function public.get_player_follower_explorations(integer) from public;
grant execute on function public.get_player_follower_explorations(integer) to anon, authenticated;

commit;
