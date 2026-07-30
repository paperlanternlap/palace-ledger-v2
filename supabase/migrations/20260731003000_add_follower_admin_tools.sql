alter table public.follower_master
  alter column weekly_mission_limit set default 2;

update public.follower_master
set weekly_mission_limit = 2,
    updated_at = now()
where weekly_mission_limit = 1;

create or replace function public.update_follower_with_talents(
  p_follower_id bigint,
  p_name text,
  p_avatar_url text,
  p_follower_type text,
  p_description text,
  p_access_areas text[],
  p_cost integer,
  p_weekly_mission_limit integer,
  p_active boolean,
  p_talents jsonb
)
returns public.follower_master
language plpgsql
security definer
set search_path = public
as $$
declare
  follower_row public.follower_master;
  talent_row jsonb;
  talent_key_value text;
begin
  if not public.is_active_staff() then
    raise exception 'Staff access required';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'Follower name is required';
  end if;

  if p_cost < 0 then
    raise exception 'Follower cost cannot be negative';
  end if;

  if p_weekly_mission_limit < 0 then
    raise exception 'Weekly mission limit cannot be negative';
  end if;

  if jsonb_typeof(coalesce(p_talents, '[]'::jsonb)) <> 'array' then
    raise exception 'Follower talents must be an array';
  end if;

  update public.follower_master
  set
    name = trim(p_name),
    avatar_url = nullif(trim(p_avatar_url), ''),
    follower_type = p_follower_type,
    description = nullif(trim(p_description), ''),
    access_areas = coalesce(p_access_areas, '{}'),
    cost = p_cost,
    weekly_mission_limit = p_weekly_mission_limit,
    active = p_active,
    updated_at = now()
  where id = p_follower_id
  returning * into follower_row;

  if not found then
    raise exception 'Follower not found';
  end if;

  delete from public.follower_talents
  where follower_id = p_follower_id;

  for talent_row in
    select value from jsonb_array_elements(coalesce(p_talents, '[]'::jsonb))
  loop
    talent_key_value := nullif(trim(talent_row->>'key'), '');
    if talent_key_value is not null then
      insert into public.follower_talents (
        follower_id,
        talent_key,
        label,
        modifier_percent
      )
      values (
        p_follower_id,
        talent_key_value,
        coalesce(nullif(trim(talent_row->>'label'), ''), talent_key_value),
        greatest(
          -100,
          least(100, coalesce((talent_row->>'modifierPercent')::integer, 0))
        )
      );
    end if;
  end loop;

  return follower_row;
end;
$$;

revoke all on function public.update_follower_with_talents(
  bigint, text, text, text, text, text[], integer, integer, boolean, jsonb
) from public;

grant execute on function public.update_follower_with_talents(
  bigint, text, text, text, text, text[], integer, integer, boolean, jsonb
) to authenticated;
