create or replace function public.adjust_character_resource(
  p_character_id integer,
  p_resource text,
  p_delta integer,
  p_note text
)
returns public.characters
language plpgsql
security definer
set search_path = public
as $$
declare
  character_row public.characters;
  current_value integer;
  next_value integer;
  resource_label text;
begin
  if not public.is_active_staff() then
    raise exception 'Staff access required';
  end if;
  if p_resource not in ('rp', 'favor') then
    raise exception 'Invalid resource';
  end if;
  if coalesce(p_delta, 0) = 0 or nullif(trim(p_note), '') is null then
    raise exception 'Amount and note are required';
  end if;

  select * into character_row
  from public.characters
  where id = p_character_id
  for update;
  if not found then raise exception 'Character not found'; end if;

  current_value := case when p_resource = 'rp' then character_row.rp else character_row.favor end;
  next_value := current_value + p_delta;
  if next_value < 0 then raise exception 'Insufficient resource'; end if;

  if p_resource = 'rp' then
    update public.characters set rp = next_value where id = p_character_id returning * into character_row;
    resource_label := 'RP';
  else
    update public.characters set favor = next_value where id = p_character_id returning * into character_row;
    resource_label := 'โปรดปราน';
  end if;

  insert into public.character_history (character_id, action, value, type)
  values (
    p_character_id,
    case when p_delta > 0 then 'เพิ่ม ' else 'หัก ' end || resource_label || ' · ' || trim(p_note),
    case when p_delta > 0 then '+' else '' end || p_delta || ' ' || resource_label,
    p_resource
  );
  return character_row;
end;
$$;

create or replace function public.adjust_character_item(
  p_character_id integer,
  p_item_id bigint,
  p_delta integer,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item_row public.items;
  inventory_row public.character_inventory;
  remove_quantity integer;
begin
  if not public.is_active_staff() then raise exception 'Staff access required'; end if;
  if coalesce(p_delta, 0) = 0 or nullif(trim(p_note), '') is null then
    raise exception 'Amount and note are required';
  end if;

  select * into item_row from public.items where id = p_item_id for update;
  if not found then raise exception 'Item not found'; end if;

  if p_delta > 0 then
    if item_row.is_limited and item_row.stock_quantity < p_delta then
      raise exception 'Insufficient stock';
    end if;
    if item_row.is_limited then
      update public.items set stock_quantity = stock_quantity - p_delta, updated_at = now()
      where id = p_item_id;
    end if;
    insert into public.character_inventory (character_id, item_name, quantity)
    values (p_character_id, item_row.name, p_delta)
    on conflict (character_id, item_name)
    do update set quantity = public.character_inventory.quantity + excluded.quantity;
  else
    remove_quantity := abs(p_delta);
    select * into inventory_row
    from public.character_inventory
    where character_id = p_character_id and item_name = item_row.name
    for update;
    if not found or inventory_row.quantity < remove_quantity then
      raise exception 'Insufficient item quantity';
    end if;
    update public.character_inventory set quantity = quantity - remove_quantity
    where id = inventory_row.id;
    delete from public.character_inventory where id = inventory_row.id and quantity = 0;
    if item_row.is_limited then
      update public.items set stock_quantity = stock_quantity + remove_quantity, updated_at = now()
      where id = p_item_id;
    end if;
  end if;

  insert into public.inventory_transactions (
    item_id, character_id, quantity_change, transaction_type, note, created_by
  ) values (
    p_item_id, p_character_id, -p_delta,
    case when p_delta > 0 then 'grant' else 'revoke' end,
    trim(p_note), auth.uid()
  );
  insert into public.character_history (character_id, action, value, type)
  values (
    p_character_id,
    case when p_delta > 0 then 'เพิ่มไอเท็ม · ' else 'นำไอเท็มออก · ' end || trim(p_note),
    case when p_delta > 0 then '+' else '-' end || abs(p_delta) || ' ' || item_row.name,
    'item'
  );
end;
$$;

create or replace function public.demote_character(
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
  previous_position text;
  old_position text;
begin
  if not public.is_active_staff() then raise exception 'Staff access required'; end if;
  if nullif(trim(p_note), '') is null then raise exception 'Note is required'; end if;

  select * into character_row from public.characters
  where id = p_character_id for update;
  if not found then raise exception 'Character not found'; end if;
  old_position := character_row.position;

  select current_position into previous_position
  from public.rank_requirements
  where next_position = old_position
  order by id
  limit 1;
  if previous_position is null then raise exception 'No lower rank available'; end if;

  update public.characters set position = previous_position
  where id = p_character_id returning * into character_row;
  insert into public.character_history (character_id, action, value, type)
  values (
    p_character_id, 'ลดขั้น · ' || trim(p_note),
    old_position || ' → ' || previous_position, 'promotion'
  );
  return character_row;
end;
$$;

revoke all on function public.adjust_character_resource(integer, text, integer, text) from public;
revoke all on function public.adjust_character_item(integer, bigint, integer, text) from public;
revoke all on function public.demote_character(integer, text) from public;
grant execute on function public.adjust_character_resource(integer, text, integer, text) to authenticated;
grant execute on function public.adjust_character_item(integer, bigint, integer, text) to authenticated;
grant execute on function public.demote_character(integer, text) to authenticated;
