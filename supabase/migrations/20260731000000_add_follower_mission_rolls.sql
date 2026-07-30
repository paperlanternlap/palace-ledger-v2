alter table public.exploration_locations
  add column if not exists base_success_percent integer not null default 60
    check (base_success_percent between 5 and 95);

alter table public.follower_explorations
  add column if not exists success_chance_percent integer
    check (success_chance_percent between 5 and 95),
  add column if not exists resolution_roll integer
    check (resolution_roll between 1 and 100),
  add column if not exists resolution_outcome text
    check (resolution_outcome in (
      'critical_success',
      'success',
      'failure',
      'critical_failure'
    )),
  add column if not exists rolled_at timestamptz,
  add column if not exists rolled_by uuid references auth.users(id);

update public.follower_explorations
set success_chance_percent = greatest(
  5,
  least(95, 60 + coalesce(suitability_percent, 0))
)
where success_chance_percent is null;

create or replace function public.set_follower_exploration_chance()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  base_chance integer := 60;
begin
  if new.location_id is not null then
    select location.base_success_percent into base_chance
    from public.exploration_locations location
    where location.id = new.location_id;
  end if;

  new.success_chance_percent := greatest(
    5,
    least(95, coalesce(base_chance, 60) + coalesce(new.suitability_percent, 0))
  );
  return new;
end;
$$;

drop trigger if exists set_follower_exploration_chance
  on public.follower_explorations;
create trigger set_follower_exploration_chance
before insert or update of location_id, suitability_percent
on public.follower_explorations
for each row
execute function public.set_follower_exploration_chance();

create or replace function public.roll_follower_exploration(
  p_mission_id bigint
)
returns public.follower_explorations
language plpgsql
security definer
set search_path = public
as $$
declare
  mission_row public.follower_explorations;
  rolled_value integer;
  outcome_value text;
begin
  if not public.is_active_staff() then
    raise exception 'Staff access required';
  end if;

  select * into mission_row
  from public.follower_explorations
  where id = p_mission_id
  for update;

  if not found or mission_row.status <> 'exploring' then
    raise exception 'Active exploration not found';
  end if;

  if mission_row.resolution_roll is not null then
    raise exception 'Exploration result has already been rolled';
  end if;

  rolled_value := floor(random() * 100 + 1)::integer;

  outcome_value := case
    when rolled_value <= 5 then 'critical_success'
    when rolled_value <= mission_row.success_chance_percent then 'success'
    when rolled_value >= 96 then 'critical_failure'
    else 'failure'
  end;

  update public.follower_explorations
  set
    resolution_roll = rolled_value,
    resolution_outcome = outcome_value,
    rolled_at = now(),
    rolled_by = auth.uid()
  where id = p_mission_id
  returning * into mission_row;

  return mission_row;
end;
$$;

revoke all on function public.roll_follower_exploration(bigint) from public;
grant execute on function public.roll_follower_exploration(bigint)
  to authenticated;

create or replace function public.require_follower_exploration_roll()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'completed'
    and old.status = 'exploring'
    and new.resolution_outcome is null then
    raise exception 'Exploration result must be rolled before resolution';
  end if;
  return new;
end;
$$;

drop trigger if exists require_follower_exploration_roll
  on public.follower_explorations;
create trigger require_follower_exploration_roll
before update of status
on public.follower_explorations
for each row
execute function public.require_follower_exploration_roll();
