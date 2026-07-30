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

  select * into character_row
  from public.characters
  where id = p_character_id
  for update;
  if not found then raise exception 'Character not found'; end if;

  select * into requirement_row
  from public.rank_requirements
  where current_position = character_row.position
  order by id
  limit 1;
  if not found then raise exception 'No higher rank available'; end if;

  if character_row.favor < requirement_row.favor_required then
    raise exception 'Insufficient favor';
  end if;

  if requirement_row.max_slots is not null then
    select count(*) into occupied_slots
    from public.characters
    where position = requirement_row.next_position
      and id <> p_character_id;
    if occupied_slots >= requirement_row.max_slots then
      raise exception 'Rank slots are full';
    end if;
  end if;

  old_position := character_row.position;
  update public.characters
  set
    position = requirement_row.next_position,
    favor = favor - requirement_row.favor_required
  where id = p_character_id
  returning * into character_row;

  insert into public.character_history (character_id, action, value, type)
  values (
    p_character_id,
    'เลื่อนขั้นโดยสต๊าฟ · ' || trim(p_note),
    old_position || ' → ' || requirement_row.next_position ||
      ' · -' || requirement_row.favor_required || ' โปรดปราน',
    'promotion'
  );

  return character_row;
end;
$$;

revoke all on function public.promote_character_staff(integer, text) from public;
grant execute on function public.promote_character_staff(integer, text) to authenticated;
