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
  mission_count integer;
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

  select count(*) into mission_count
  from public.follower_explorations
  where follower_id = p_follower_id
    and started_at >= date_trunc('week', now())
    and status <> 'cancelled';

  if mission_count >= coalesce(follower_row.weekly_mission_limit, 1) then
    raise exception 'Follower weekly mission limit reached';
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
