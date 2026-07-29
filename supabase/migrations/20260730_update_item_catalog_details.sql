create or replace function public.update_catalog_item(
  p_item_id bigint,
  p_name text,
  p_description text,
  p_use_category text,
  p_default_channel text,
  p_requires_target boolean,
  p_requires_roll boolean,
  p_action_template jsonb,
  p_active boolean
)
returns public.items
language plpgsql
security definer
set search_path = public
as $$
declare
  target_item public.items;
  next_name text := trim(p_name);
begin
  if not public.is_active_staff() then
    raise exception 'Staff access required';
  end if;

  if next_name = '' then
    raise exception 'Item name is required';
  end if;

  if jsonb_typeof(coalesce(p_action_template, '[]'::jsonb)) <> 'array' then
    raise exception 'Action template must be an array';
  end if;

  select * into target_item
  from public.items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Item not found';
  end if;

  if target_item.name <> next_name then
    insert into public.character_inventory (character_id, item_name, quantity)
    select character_id, next_name, quantity
    from public.character_inventory
    where item_name = target_item.name
    on conflict (character_id, item_name)
    do update set quantity = public.character_inventory.quantity + excluded.quantity;

    delete from public.character_inventory
    where item_name = target_item.name;
  end if;

  update public.items
  set
    name = next_name,
    description = nullif(trim(p_description), ''),
    use_category = coalesce(nullif(trim(p_use_category), ''), 'general'),
    default_channel = nullif(trim(p_default_channel), ''),
    requires_target = p_requires_target,
    requires_roll = p_requires_roll,
    action_template = coalesce(p_action_template, '[]'::jsonb),
    active = p_active,
    updated_at = now()
  where id = p_item_id
  returning * into target_item;

  return target_item;
end;
$$;

revoke all on function public.update_catalog_item(
  bigint, text, text, text, text, boolean, boolean, jsonb, boolean
) from public;

grant execute on function public.update_catalog_item(
  bigint, text, text, text, text, boolean, boolean, jsonb, boolean
) to authenticated;
