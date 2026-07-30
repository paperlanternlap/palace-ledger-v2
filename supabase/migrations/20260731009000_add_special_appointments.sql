alter table public.characters
  add column if not exists promotion_locked boolean not null default false,
  add column if not exists promotion_lock_reason text;

create or replace function public.special_appoint_character(
  p_character_id integer,
  p_role text,
  p_position text,
  p_action text,
  p_note text,
  p_restore_normal_promotion boolean default false
)
returns public.characters
language plpgsql
security definer
set search_path = public
as $$
declare
  character_row public.characters;
  old_role text;
  old_position text;
  target_max_slots integer;
  occupied_slots integer;
begin
  if not public.is_active_staff() then raise exception 'Staff access required'; end if;
  if p_action not in ('appointment', 'imperial_demote') then raise exception 'Invalid special action'; end if;
  if nullif(trim(p_role), '') is null or nullif(trim(p_position), '') is null then
    raise exception 'Role and position are required';
  end if;
  if nullif(trim(p_note), '') is null then raise exception 'Note is required'; end if;

  select * into character_row from public.characters
  where id = p_character_id for update;
  if not found then raise exception 'Character not found'; end if;

  old_role := character_row.role;
  old_position := character_row.position;

  select max_slots into target_max_slots
  from public.rank_requirements
  where next_position = trim(p_position)
  order by id
  limit 1;
  if target_max_slots is not null and old_position is distinct from trim(p_position) then
    select count(*) into occupied_slots
    from public.characters
    where position = trim(p_position) and id <> p_character_id;
    if occupied_slots >= target_max_slots then raise exception 'Rank slots are full'; end if;
  end if;

  update public.characters
  set
    role = trim(p_role),
    position = trim(p_position),
    promotion_locked = case
      when p_action = 'imperial_demote' then true
      when p_restore_normal_promotion then false
      else promotion_locked
    end,
    promotion_lock_reason = case
      when p_action = 'imperial_demote' then trim(p_note)
      when p_restore_normal_promotion then null
      else promotion_lock_reason
    end
  where id = p_character_id
  returning * into character_row;

  insert into public.character_history (character_id, action, value, type)
  values (
    p_character_id,
    case
      when p_action = 'imperial_demote' then 'ลดขั้นพิเศษโดยพระราชโองการ · '
      else 'แต่งตั้งพิเศษ · '
    end || trim(p_note),
    coalesce(old_role, 'ไม่ระบุ') || ' / ' || coalesce(old_position, 'ไม่ระบุ') ||
      ' → ' || trim(p_role) || ' / ' || trim(p_position),
    'promotion'
  );

  if p_restore_normal_promotion then
    insert into public.character_history (character_id, action, value, type)
    values (
      p_character_id, 'คืนสิทธิ์เลื่อนขั้นตามระบบโปรดปราน · ' || trim(p_note),
      'ปลดล็อกการเลื่อนขั้น', 'promotion'
    );
  end if;

  return character_row;
end;
$$;

create or replace function public.promote_character_staff(
  p_character_id integer,
  p_note text
)
returns public.characters
language plpgsql
security definer
set search_path = public
as $$
declare
  character_row public.characters;
  requirement_row public.rank_requirements;
  occupied_slots integer;
  old_position text;
begin
  if not public.is_active_staff() then raise exception 'Staff access required'; end if;
  if nullif(trim(p_note), '') is null then raise exception 'Note is required'; end if;
  select * into character_row from public.characters where id = p_character_id for update;
  if not found then raise exception 'Character not found'; end if;
  if character_row.promotion_locked then raise exception 'Normal promotion is locked'; end if;

  select * into requirement_row from public.rank_requirements
  where current_position = character_row.position order by id limit 1;
  if not found then raise exception 'No higher rank available'; end if;
  if character_row.favor < requirement_row.favor_required then raise exception 'Insufficient favor'; end if;
  if requirement_row.max_slots is not null then
    select count(*) into occupied_slots from public.characters
    where position = requirement_row.next_position and id <> p_character_id;
    if occupied_slots >= requirement_row.max_slots then raise exception 'Rank slots are full'; end if;
  end if;

  old_position := character_row.position;
  update public.characters
  set position = requirement_row.next_position,
      favor = favor - requirement_row.favor_required
  where id = p_character_id returning * into character_row;
  insert into public.character_history (character_id, action, value, type)
  values (
    p_character_id, 'เลื่อนขั้นโดยสต๊าฟ · ' || trim(p_note),
    old_position || ' → ' || requirement_row.next_position ||
      ' · -' || requirement_row.favor_required || ' โปรดปราน', 'promotion'
  );
  return character_row;
end;
$$;

revoke all on function public.special_appoint_character(integer, text, text, text, text, boolean) from public;
grant execute on function public.special_appoint_character(integer, text, text, text, text, boolean) to authenticated;
