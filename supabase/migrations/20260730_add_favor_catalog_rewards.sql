alter table public.items
  add column if not exists price_currency text not null default 'rp',
  add column if not exists fulfillment_type text not null default 'inventory';

alter table public.items
  drop constraint if exists items_price_currency_check,
  add constraint items_price_currency_check
    check (price_currency in ('rp', 'favor')),
  drop constraint if exists items_fulfillment_type_check,
  add constraint items_fulfillment_type_check
    check (fulfillment_type in ('inventory', 'staff_request'));

create or replace function public.set_item_purchase_settings(
  p_item_id bigint,
  p_price_currency text,
  p_fulfillment_type text
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

  if p_price_currency not in ('rp', 'favor') then
    raise exception 'Unsupported price currency';
  end if;

  if p_fulfillment_type not in ('inventory', 'staff_request') then
    raise exception 'Unsupported fulfillment type';
  end if;

  update public.items
  set
    price_currency = p_price_currency,
    fulfillment_type = p_fulfillment_type,
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
  request_id bigint;
  task jsonb;
  task_order integer := 10;
  currency_label text;
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

  if target_item.price_currency = 'favor' then
    if coalesce(target_character.favor, 0) < target_item.cost then
      raise exception 'Insufficient Favor';
    end if;

    update public.characters
    set favor = coalesce(favor, 0) - target_item.cost
    where id = p_character_id;
    currency_label := 'โปรดปราน';
  else
    if coalesce(target_character.rp, 0) < target_item.cost then
      raise exception 'Insufficient RP';
    end if;

    update public.characters
    set rp = coalesce(rp, 0) - target_item.cost
    where id = p_character_id;
    currency_label := 'RP';
  end if;

  if target_item.is_limited and target_item.stock_quantity < 1 then
    raise exception 'Item is out of stock';
  end if;

  if target_item.is_limited then
    update public.items
    set stock_quantity = stock_quantity - 1, updated_at = now()
    where id = p_item_id
    returning * into target_item;
  end if;

  if target_item.fulfillment_type = 'staff_request' then
    insert into public.item_use_requests (
      requester_character_id,
      item_id,
      quantity,
      request_type,
      use_channel,
      desired_effect,
      details,
      status,
      item_reserved,
      requested_by
    )
    values (
      p_character_id,
      p_item_id,
      1,
      'unlock',
      target_item.default_channel,
      coalesce(nullif(trim(target_item.description), ''), target_item.name),
      'แลกจากร้านด้วย ' || target_item.cost || ' ' || currency_label,
      'action_pending',
      false,
      auth.uid()
    )
    returning id into request_id;

    insert into public.item_request_tasks (
      request_id,
      label,
      task_type,
      sort_order
    )
    values (
      request_id,
      'ตรวจสอบการหัก ' || currency_label || ' และสิทธิ์แลก',
      'validation',
      1
    );

    if jsonb_typeof(target_item.action_template) = 'array'
      and jsonb_array_length(target_item.action_template) > 0 then
      for task in select * from jsonb_array_elements(target_item.action_template)
      loop
        insert into public.item_request_tasks (
          request_id,
          label,
          task_type,
          sort_order
        )
        values (
          request_id,
          coalesce(nullif(trim(task->>'label'), ''), 'ดำเนินสิทธิ์พิเศษ'),
          case
            when task->>'type' in ('staff_action', 'player_action', 'validation')
              then task->>'type'
            else 'staff_action'
          end,
          task_order
        );
        task_order := task_order + 10;
      end loop;
    else
      insert into public.item_request_tasks (
        request_id,
        label,
        task_type,
        sort_order
      )
      values (
        request_id,
        'ดำเนินเหตุการณ์: ' || target_item.name,
        'staff_action',
        10
      );
    end if;
  else
    insert into public.character_inventory (character_id, item_name, quantity)
    values (p_character_id, target_item.name, 1)
    on conflict (character_id, item_name)
    do update set quantity = public.character_inventory.quantity + 1;
  end if;

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
    'แลกด้วย ' || target_item.cost || ' ' || currency_label
  );

  insert into public.character_history (
    character_id,
    action,
    value,
    type
  )
  values (
    p_character_id,
    case
      when target_item.fulfillment_type = 'staff_request'
        then 'แลกเหตุการณ์พิเศษ'
      else 'ซื้อไอเท็ม'
    end,
    target_item.name || ' · ' || target_item.cost || ' ' || currency_label,
    'shop'
  );

  return target_item;
end;
$$;

revoke all on function public.set_item_purchase_settings(bigint, text, text)
  from public;
grant execute on function public.set_item_purchase_settings(bigint, text, text)
  to authenticated;

revoke all on function public.purchase_catalog_item(integer, bigint)
  from public;
grant execute on function public.purchase_catalog_item(integer, bigint)
  to anon, authenticated;

