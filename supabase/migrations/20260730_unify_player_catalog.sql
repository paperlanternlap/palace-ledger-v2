alter table public.items
  add column if not exists cost integer not null default 0
    check (cost >= 0);

alter table public.follower_master
  add column if not exists updated_at timestamptz not null default now();

insert into public.items (
  name,
  description,
  cost,
  active,
  is_limited,
  stock_quantity
)
select
  source.name,
  source.description,
  greatest(coalesce(source.cost, 0), 0),
  coalesce(source.active, true),
  false,
  0
from public.item_master source
where not exists (
  select 1
  from public.items target
  where target.name = source.name
);

update public.items target
set
  cost = greatest(coalesce(source.cost, target.cost, 0), 0),
  description = coalesce(target.description, source.description),
  active = coalesce(source.active, target.active)
from public.item_master source
where target.name = source.name;

alter table public.inventory_transactions
  drop constraint if exists inventory_transactions_transaction_type_check;

alter table public.inventory_transactions
  add constraint inventory_transactions_transaction_type_check
  check (
    transaction_type in (
      'initial', 'restock', 'adjustment', 'grant',
      'revoke', 'use', 'purchase'
    )
  );

create policy "Players can view active catalog items"
  on public.items for select
  to anon
  using (active);

create or replace function public.update_catalog_item_details(
  p_item_id bigint,
  p_name text,
  p_description text,
  p_cost integer,
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

  if p_cost < 0 then
    raise exception 'Cost must not be negative';
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
    cost = p_cost,
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
  where id = p_item_id and active
  for update;

  if not found then
    raise exception 'Active item not found';
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

create or replace function public.purchase_follower(
  p_character_id integer,
  p_follower_id bigint
)
returns public.follower_master
language plpgsql
security definer
set search_path = public
as $$
declare
  target_follower public.follower_master;
  target_character public.characters;
begin
  select * into target_character
  from public.characters
  where id = p_character_id
  for update;

  if not found then
    raise exception 'Character not found';
  end if;

  select * into target_follower
  from public.follower_master
  where id = p_follower_id
  for update;

  if not found or not target_follower.active then
    raise exception 'Active follower not found';
  end if;

  if target_follower.owner_character_id is not null then
    raise exception 'Follower already has an owner';
  end if;

  if target_character.rp < target_follower.cost then
    raise exception 'Insufficient RP';
  end if;

  update public.characters
  set rp = rp - target_follower.cost
  where id = p_character_id;

  update public.follower_master
  set
    owner_character_id = p_character_id,
    status = 'idle',
    updated_at = now()
  where id = p_follower_id
  returning * into target_follower;

  insert into public.character_history (
    character_id,
    action,
    value,
    type
  )
  values (
    p_character_id,
    'รับผู้ติดตามใหม่',
    target_follower.name,
    'follower'
  );

  return target_follower;
end;
$$;

revoke all on function public.update_catalog_item_details(
  bigint, text, text, integer, text, text, boolean, boolean, jsonb, boolean
) from public;
revoke all on function public.purchase_catalog_item(integer, bigint) from public;
revoke all on function public.purchase_follower(integer, bigint) from public;

grant execute on function public.update_catalog_item_details(
  bigint, text, text, integer, text, text, boolean, boolean, jsonb, boolean
) to authenticated;
grant execute on function public.purchase_catalog_item(integer, bigint) to anon, authenticated;
grant execute on function public.purchase_follower(integer, bigint) to anon, authenticated;
