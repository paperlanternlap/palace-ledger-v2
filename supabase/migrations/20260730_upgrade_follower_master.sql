alter table public.follower_master
  add column if not exists avatar_url text,
  add column if not exists follower_type text not null default 'other',
  add column if not exists access_areas text[] not null default '{}',
  add column if not exists weekly_mission_limit integer not null default 1
    check (weekly_mission_limit >= 0),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists follower_master_owner_character
  on public.follower_master (owner_character_id)
  where owner_character_id is not null;

create or replace function public.assign_follower_to_character(
  p_follower_id bigint,
  p_character_id integer
)
returns public.follower_master
language plpgsql
security definer
set search_path = public
as $$
declare
  follower_row public.follower_master;
begin
  if not public.is_active_staff() then
    raise exception 'Staff access required';
  end if;

  select * into follower_row
  from public.follower_master
  where id = p_follower_id
  for update;

  if not found then
    raise exception 'Follower not found';
  end if;

  if follower_row.owner_character_id is not null then
    raise exception 'Follower already has an owner';
  end if;

  if not follower_row.active then
    raise exception 'Follower is not active';
  end if;

  update public.follower_master
  set
    owner_character_id = p_character_id,
    status = 'idle',
    updated_at = now()
  where id = p_follower_id
  returning * into follower_row;

  return follower_row;
end;
$$;

create or replace function public.release_follower(
  p_follower_id bigint
)
returns public.follower_master
language plpgsql
security definer
set search_path = public
as $$
declare
  follower_row public.follower_master;
begin
  if not public.is_active_staff() then
    raise exception 'Staff access required';
  end if;

  select * into follower_row
  from public.follower_master
  where id = p_follower_id
  for update;

  if not found then
    raise exception 'Follower not found';
  end if;

  if follower_row.status <> 'idle' then
    raise exception 'Follower is currently on a mission';
  end if;

  update public.follower_master
  set
    owner_character_id = null,
    status = 'idle',
    updated_at = now()
  where id = p_follower_id
  returning * into follower_row;

  return follower_row;
end;
$$;

revoke all on function public.assign_follower_to_character(bigint, integer) from public;
revoke all on function public.release_follower(bigint) from public;

grant execute on function public.assign_follower_to_character(bigint, integer) to authenticated;
grant execute on function public.release_follower(bigint) to authenticated;
