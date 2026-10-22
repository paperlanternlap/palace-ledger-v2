begin;

alter table public.follower_explorations
  add column if not exists drop_roll integer check (drop_roll between 1 and 100);

-- The player triggers both draws. Failure has no item number.
create or replace function public.draw_player_exploration_result(
  p_character_id integer, p_mission_id bigint
)
returns public.follower_explorations
language plpgsql security definer set search_path = public as $$
declare
  mission public.follower_explorations;
  passed boolean;
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
  passed := random() < mission.success_chance_percent / 100.0;
  update public.follower_explorations set
    resolution_outcome = case when passed then 'success' else 'failure' end,
    drop_roll = case when passed then floor(random() * 100 + 1)::integer else null end,
    roll_origin = 'player',
    rolled_at = now()
  where id = p_mission_id returning * into mission;
  mission.result_details := null;
  return mission;
end;
$$;
revoke all on function public.draw_player_exploration_result(integer,bigint) from public;
grant execute on function public.draw_player_exploration_result(integer,bigint) to anon, authenticated;

-- Work that succeeded before this update can receive its d100 once in player history.
create or replace function public.draw_player_exploration_drop(
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
  if mission.drop_roll is not null then
    mission.result_details := null;
    return mission;
  end if;
  if mission.status <> 'exploring' or mission.resolution_outcome not in ('success', 'critical_success') then
    raise exception 'Successful active exploration required';
  end if;
  update public.follower_explorations
  set drop_roll = floor(random() * 100 + 1)::integer
  where id = p_mission_id returning * into mission;
  mission.result_details := null;
  return mission;
end;
$$;
revoke all on function public.draw_player_exploration_drop(integer,bigint) from public;
grant execute on function public.draw_player_exploration_drop(integer,bigint) to anon, authenticated;

-- For player-drawn work, staff must receive the saved d100 before resolving success.
create or replace function public.require_player_exploration_drop()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'completed' and old.status = 'exploring'
    and new.roll_origin = 'player'
    and new.resolution_outcome in ('success', 'critical_success')
    and new.drop_roll is null then
    raise exception 'Player item number is required before resolving exploration';
  end if;
  return new;
end;
$$;
drop trigger if exists require_player_exploration_drop on public.follower_explorations;
create trigger require_player_exploration_drop before update of status
  on public.follower_explorations for each row
  execute function public.require_player_exploration_drop();

drop function if exists public.get_player_follower_explorations(integer);
create function public.get_player_follower_explorations(p_character_id integer)
returns table (
  id bigint, follower_id bigint, destination text, objective text, status text,
  result_summary text, result_details text, reward_item_name text,
  reward_quantity integer, started_at timestamptz, completed_at timestamptz,
  resolution_outcome text, drop_roll integer
)
language sql stable security definer set search_path = public as $$
  select mission.id, mission.follower_id, mission.destination, mission.objective,
    mission.status, mission.result_summary, null::text, reward.name,
    mission.reward_quantity, mission.started_at, mission.completed_at,
    mission.resolution_outcome, mission.drop_roll
  from public.follower_explorations mission
  left join public.items reward on reward.id = mission.reward_item_id
  where mission.character_id = p_character_id
  order by mission.started_at desc limit 30;
$$;
revoke all on function public.get_player_follower_explorations(integer) from public;
grant execute on function public.get_player_follower_explorations(integer) to anon, authenticated;

notify pgrst, 'reload schema';
commit;

begin;

-- Older successful jobs were drawn before the d100 became part of the first click.
-- Give each active job one permanent number so staff can finish it without
-- asking the player to return and draw again.
update public.follower_explorations
set drop_roll = floor(random() * 100 + 1)::integer
where status = 'exploring'
  and resolution_outcome in ('success', 'critical_success')
  and drop_roll is null;

commit;
