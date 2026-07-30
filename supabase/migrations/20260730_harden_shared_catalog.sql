alter table public.items
  add column if not exists shop_available boolean not null default false;

update public.items target
set shop_available = true
where exists (
  select 1
  from public.item_master source
  where source.name = target.name
    and coalesce(source.active, true)
);

drop policy if exists "Players can view active catalog items"
  on public.items;

drop policy if exists "Players can view shop catalog items"
  on public.items;

create policy "Players can view shop catalog items"
  on public.items for select
  to anon
  using (active and shop_available);

update public.follower_master
set status = coalesce(
  nullif(btrim(status, E' \n\r\t'), ''),
  'idle'
)
where status is null
   or status is distinct from btrim(status, E' \n\r\t')
   or btrim(status, E' \n\r\t') = '';

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

  if btrim(coalesce(follower_row.status, ''), E' \n\r\t') <> 'idle' then
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

create or replace function public.set_item_shop_availability(
  p_item_id bigint,
  p_shop_available boolean
)
returns public.items
language plpgsql
security definer
set search_path = public
as $$
declare
  target_item public.items;
begin
  if not public.is_active_staff() then
    raise exception 'Staff access required';
  end if;

  update public.items
  set
    shop_available = p_shop_available,
    updated_at = now()
  where id = p_item_id
  returning * into target_item;

  if not found then
    raise exception 'Item not found';
  end if;

  return target_item;
end;
$$;

create or replace function public.purchase_catalog_item(
  p_character_id integer,
  p_item_id bigint
)
returns public.items
language plpgsql
security definer
set search_path = public
as $$
declare
  target_item public.items;
  target_character public.characters;
begin
  select * into target_character
  from public.characters
  where id = p_character_id
  for update;

  if not found then
    raise exception 'Character not found';
  end if;

  select * into target_item
  from public.items
  where id = p_item_id
    and active
    and shop_available
  for update;

  if not found then
    raise exception 'Shop item not found';
  end if;

  if target_character.rp < target_item.cost then
    raise exception 'Insufficient RP';
  end if;

  if target_item.is_limited and target_item.stock_quantity < 1 then
    raise exception 'Item is out of stock';
  end if;

  update public.characters
  set rp = rp - target_item.cost
  where id = p_character_id;

  if target_item.is_limited then
    update public.items
    set stock_quantity = stock_quantity - 1, updated_at = now()
    where id = p_item_id
    returning * into target_item;
  end if;

  insert into public.character_inventory (character_id, item_name, quantity)
  values (p_character_id, target_item.name, 1)
  on conflict (character_id, item_name)
  do update set quantity = public.character_inventory.quantity + 1;

  insert into public.inventory_transactions (
    item_id,
    character_id,
    quantity_change,
    transaction_type,
    note
  )
  values (
    p_item_id,
    p_character_id,
    -1,
    'purchase',
    'ซื้อจากร้านด้วย ' || target_item.cost || ' RP'
  );

  insert into public.character_history (
    character_id,
    action,
    value,
    type
  )
  values (
    p_character_id,
    'ซื้อไอเท็ม',
    target_item.name,
    'shop'
  );

  return target_item;
end;
$$;

revoke all on function public.set_item_shop_availability(bigint, boolean) from public;
grant execute on function public.set_item_shop_availability(bigint, boolean) to authenticated;
