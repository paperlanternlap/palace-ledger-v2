-- Remove round and calendar quotas. Keep the existing pending-mission workflow.
begin;
drop index if exists public.self_exploration_one_per_round;
revoke update on public.exploration_settings from authenticated;
drop policy if exists "Staff update exploration round" on public.exploration_settings;
create or replace function public.get_player_exploration_map(p_character_id integer)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(
    (to_jsonb(l) - 'self_character_ids') || jsonb_build_object('can_explore_self',
      p_character_id = any(l.self_character_ids)
      and not exists (select 1 from public.follower_explorations m
        where m.character_id = p_character_id and m.follower_id is null
          and m.status = 'exploring'))
    order by l.sort_order), '[]'::jsonb)
  from public.exploration_locations l
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
    -- The established RPC enforces access, idle status and talents.
    mission := public.start_follower_exploration(p_character_id, p_follower_id, p_location_id, 'สำรวจและจัดหาของใช้');
    update public.follower_explorations set request_id = p_request_id where id = mission.id returning * into mission;
    mission.result_details := null;
    return mission;
  end if;

  if not (p_character_id = any(place.self_character_ids)) then raise exception 'Location access required'; end if;
  if exists (select 1 from public.follower_explorations where character_id = p_character_id
      and follower_id is null and status = 'exploring') then raise exception 'An active exploration already exists'; end if;
  insert into public.follower_explorations(character_id, follower_id, location_id, destination,
    objective, suitability_percent, request_id)
  values (p_character_id, null, place.id, place.name, 'สำรวจและจัดหาของใช้', 0, p_request_id)
  returning * into mission;
  insert into public.character_history(character_id, action, value, type)
    values(p_character_id, 'ออกสำรวจด้วยตัวเอง', place.name, 'follower_mission');
  return mission;
end;
$$;


create or replace function public.start_follower_exploration(
  p_character_id integer,
  p_follower_id bigint,
  p_location_id bigint,
  p_objective text default null
)
returns public.follower_explorations
language plpgsql
security definer
set search_path = public
as $$
declare
  follower_row public.follower_master;
  location_row public.exploration_locations;
  mission_row public.follower_explorations;
  suitability integer;
begin
  select * into follower_row
  from public.follower_master
  where id = p_follower_id
  for update;

  if not found
    or follower_row.owner_character_id is distinct from p_character_id then
    raise exception 'Follower does not belong to this character';
  end if;

  if btrim(coalesce(follower_row.status, ''), E' \n\r\t') <> 'idle' then
    raise exception 'Follower is already on a mission';
  end if;

  select * into location_row
  from public.exploration_locations
  where id = p_location_id and active;

  if not found then
    raise exception 'Exploration location is not available';
  end if;

  if not (
    location_row.short_name = any(coalesce(follower_row.access_areas, '{}'))
    or location_row.name = any(coalesce(follower_row.access_areas, '{}'))
    or location_row.category = any(coalesce(follower_row.access_areas, '{}'))
    or location_row.code = any(coalesce(follower_row.access_areas, '{}'))
  ) then
    raise exception 'Follower cannot access this exploration location';
  end if;


  select coalesce(sum(talent.modifier_percent), 0)::integer
  into suitability
  from public.follower_talents talent
  where talent.follower_id = p_follower_id
    and talent.talent_key = any(location_row.tags);

  insert into public.follower_explorations (
    follower_id,
    character_id,
    location_id,
    destination,
    objective,
    suitability_percent
  )
  values (
    p_follower_id,
    p_character_id,
    location_row.id,
    location_row.name,
    nullif(trim(p_objective), ''),
    suitability
  )
  returning * into mission_row;

  update public.follower_master
  set status = 'exploring', updated_at = now()
  where id = p_follower_id;

  insert into public.character_history (
    character_id,
    action,
    value,
    type
  )
  values (
    p_character_id,
    'ส่งผู้ติดตามสำรวจ',
    follower_row.name || ' → ' || location_row.short_name,
    'follower_mission'
  );

  return mission_row;
end;
$$;

revoke all on function public.start_follower_exploration(
  integer, bigint, bigint, text
) from public;

grant execute on function public.start_follower_exploration(
  integer, bigint, bigint, text
) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
commit;
