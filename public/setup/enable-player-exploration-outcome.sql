begin;

-- A chance is the share of successful draws, not a required dice number.
-- Talent modifiers are relative to the area's base chance: 50% + 40% Talent = 70%.
create or replace function public.set_follower_exploration_chance()
returns trigger language plpgsql set search_path = public as $$
declare
  base_chance integer := 60;
begin
  if new.location_id is not null then
    select location.base_success_percent into base_chance
    from public.exploration_locations location where location.id = new.location_id;
  end if;
  new.success_chance_percent := greatest(5, least(95,
    round(coalesce(base_chance, 60) * (1 + coalesce(new.suitability_percent, 0) / 100.0))::integer
  ));
  return new;
end;
$$;

-- Preserve every historical result; only recalculate unrolled work.
update public.follower_explorations
set suitability_percent = suitability_percent
where status = 'exploring' and resolution_outcome is null;

alter table public.follower_explorations
  add column if not exists roll_origin text check (roll_origin in ('player'));

create or replace function public.draw_player_exploration_result(
  p_character_id integer, p_mission_id bigint
)
returns public.follower_explorations
language plpgsql security definer set search_path = public as $$
declare
  mission public.follower_explorations;
begin
  perform 1 from public.characters where id = p_character_id for update;
  if not found then raise exception 'Character not available'; end if;
  select * into mission from public.follower_explorations
  where id = p_mission_id and character_id = p_character_id for update;
  if not found then raise exception 'Exploration not found'; end if;
  if mission.resolution_outcome is not null then
    mission.result_details := null;
    return mission;
  end if;
  if mission.status <> 'exploring' then raise exception 'Exploration is no longer active'; end if;
  update public.follower_explorations set
    resolution_outcome = case when random() < mission.success_chance_percent / 100.0
      then 'success' else 'failure' end,
    roll_origin = 'player',
    rolled_at = now()
  where id = p_mission_id returning * into mission;
  mission.result_details := null;
  return mission;
end;
$$;
revoke all on function public.draw_player_exploration_result(integer,bigint) from public;
grant execute on function public.draw_player_exploration_result(integer,bigint) to anon, authenticated;

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
    mission := public.start_follower_exploration(p_character_id, p_follower_id, p_location_id, 'สำรวจและจัดหาของใช้');
    update public.follower_explorations set request_id = p_request_id
    where id = mission.id returning * into mission;
  else
    if not (p_character_id = any(place.self_character_ids)) then raise exception 'Location access required'; end if;
    if exists (select 1 from public.follower_explorations where character_id = p_character_id
        and follower_id is null and status = 'exploring') then
      raise exception 'An active exploration already exists';
    end if;
    insert into public.follower_explorations(character_id, follower_id, location_id, destination,
      objective, suitability_percent, request_id)
    values (p_character_id, null, place.id, place.name, 'สำรวจและจัดหาของใช้', 0, p_request_id)
    returning * into mission;
    insert into public.character_history(character_id, action, value, type)
      values(p_character_id, 'ออกสำรวจด้วยตัวเอง', place.name, 'follower_mission');
  end if;
  return public.draw_player_exploration_result(p_character_id, mission.id);
end;
$$;
revoke all on function public.start_map_exploration(integer,bigint,uuid,bigint) from public;
grant execute on function public.start_map_exploration(integer,bigint,uuid,bigint) to anon, authenticated;

-- Old staff RPC cannot re-roll an outcome already drawn by the player.
create or replace function public.roll_follower_exploration(p_mission_id bigint)
returns public.follower_explorations
language plpgsql security definer set search_path = public as $$
begin
  raise exception 'Exploration results are drawn by the player';
end;
$$;
revoke all on function public.roll_follower_exploration(bigint) from public, anon, authenticated;

-- Player history includes the outcome, but never staff-only details.
drop function if exists public.get_player_follower_explorations(integer);
create function public.get_player_follower_explorations(p_character_id integer)
returns table (
  id bigint, follower_id bigint, destination text, objective text, status text,
  result_summary text, result_details text, reward_item_name text,
  reward_quantity integer, started_at timestamptz, completed_at timestamptz,
  resolution_outcome text
)
language sql stable security definer set search_path = public as $$
  select mission.id, mission.follower_id, mission.destination, mission.objective,
    mission.status, mission.result_summary, null::text, reward.name,
    mission.reward_quantity, mission.started_at, mission.completed_at,
    mission.resolution_outcome
  from public.follower_explorations mission
  left join public.items reward on reward.id = mission.reward_item_id
  where mission.character_id = p_character_id
  order by mission.started_at desc limit 30;
$$;
revoke all on function public.get_player_follower_explorations(integer) from public;
grant execute on function public.get_player_follower_explorations(integer) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
