-- Run after 20260815000000_complete_item_economy_and_risk.sql.
-- Legal external purchases are scheduled automatically and finalized lazily
-- when the player opens the site. No Cron or Edge Function is required.

begin;

alter table public.item_acquisition_requests
  add column if not exists auto_delivery boolean not null default false,
  add column if not exists available_at timestamptz;

create index if not exists item_acquisition_requests_due_delivery
  on public.item_acquisition_requests (character_id, available_at)
  where auto_delivery and status = 'procuring' and not item_granted;

create or replace function public.submit_item_acquisition_request(
  p_character_id integer,
  p_item_id bigint,
  p_quantity integer default 1,
  p_player_note text default null
)
returns public.item_acquisition_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  character_row public.characters;
  item_row public.items;
  unlock_row public.character_catalog_unlocks;
  request_row public.item_acquisition_requests;
  route_value text;
  should_auto_fulfill boolean;
  should_schedule_delivery boolean;
  can_command boolean := false;
  total_cost integer;
  delivery_days_min integer;
  delivery_days_max integer;
  delivery_days integer;
begin
  if p_quantity <= 0 then raise exception 'Quantity must be positive'; end if;

  select * into character_row from public.characters
  where id = p_character_id for update;
  if not found then raise exception 'Character not found'; end if;

  select * into item_row from public.items
  where id = p_item_id and active for update;
  if not found then raise exception 'Catalog item not found'; end if;

  if item_row.acquisition_type = 'story_only' then
    raise exception 'Story items cannot be requested from the catalog';
  end if;
  if item_row.catalog_visibility = 'staff_only' then
    raise exception 'Catalog item is not available';
  end if;
  if item_row.catalog_visibility = 'locked' then
    select * into unlock_row from public.character_catalog_unlocks
    where character_id = p_character_id and item_id = p_item_id;
    if not found then raise exception 'Acquisition channel is locked'; end if;
  end if;
  if coalesce(character_row.favor, 0) < item_row.minimum_favor then
    raise exception 'Insufficient Favor threshold';
  end if;
  if item_row.price_currency <> 'rp' then
    raise exception 'Catalog acquisition must use RP';
  end if;

  select exists (
    select 1
    from public.character_position_acquisition_privileges privilege
    where privilege.position = character_row.position
      and privilege.can_command_external_purchase
  ) into can_command;

  total_cost := item_row.cost * p_quantity;
  route_value := case
    when item_row.acquisition_type = 'palace_stock' then 'requisition'
    when item_row.acquisition_type = 'external_legal' and can_command then 'command'
    when item_row.acquisition_type = 'external_legal' then 'procurement'
    else 'restricted_contact'
  end;
  should_auto_fulfill := item_row.acquisition_type = 'palace_stock'
    and item_row.auto_fulfill and not item_row.acquisition_requires_roll;
  should_schedule_delivery := item_row.acquisition_type = 'external_legal'
    and not item_row.acquisition_requires_roll;

  if should_auto_fulfill or should_schedule_delivery then
    if coalesce(character_row.rp, 0) < total_cost then raise exception 'Insufficient RP'; end if;
    if item_row.is_limited and item_row.stock_quantity < p_quantity then
      raise exception 'Item is out of stock';
    end if;

    update public.characters set rp = coalesce(rp, 0) - total_cost
      where id = p_character_id;
    if item_row.is_limited then
      update public.items set stock_quantity = stock_quantity - p_quantity, updated_at = now()
      where id = p_item_id;
    end if;
  end if;

  if should_auto_fulfill then
    insert into public.character_inventory (character_id, item_name, quantity)
    values (p_character_id, item_row.name, p_quantity)
    on conflict (character_id, item_name)
    do update set quantity = public.character_inventory.quantity + excluded.quantity;

    insert into public.item_acquisition_requests (
      character_id, item_id, quantity, request_route, status, player_note,
      charged_currency, charged_amount, stock_reserved, item_granted,
      requested_by, completed_at, acquisition_channel_id, auto_delivery
    ) values (
      p_character_id, p_item_id, p_quantity, route_value, 'completed',
      nullif(btrim(p_player_note), ''), 'rp', total_cost,
      false, true, auth.uid(), now(),
      item_row.acquisition_channel_id, false
    ) returning * into request_row;

    insert into public.inventory_transactions (
      item_id, character_id, quantity_change, transaction_type, note
    ) values (
      p_item_id, p_character_id, -p_quantity, 'purchase',
      'เบิกจากคลังหลวง · ' || total_cost || ' RP'
    );
  elsif should_schedule_delivery then
    delivery_days_min := case when can_command
      then greatest(0, item_row.fulfillment_days_min - 1)
      else item_row.fulfillment_days_min end;
    delivery_days_max := case when can_command
      then greatest(delivery_days_min, item_row.fulfillment_days_max - 2)
      else item_row.fulfillment_days_max end;
    delivery_days := delivery_days_min + floor(
      random() * (delivery_days_max - delivery_days_min + 1)
    )::integer;

    insert into public.item_acquisition_requests (
      character_id, item_id, quantity, request_route, status, player_note,
      charged_currency, charged_amount, stock_reserved, item_granted,
      requested_by, acquisition_channel_id, auto_delivery, available_at
    ) values (
      p_character_id, p_item_id, p_quantity, route_value, 'procuring',
      nullif(btrim(p_player_note), ''), 'rp', total_cost,
      item_row.is_limited, false, auth.uid(), item_row.acquisition_channel_id,
      true, now() + make_interval(days => delivery_days)
    ) returning * into request_row;
  else
    insert into public.item_acquisition_requests (
      character_id, item_id, quantity, request_route, status, player_note,
      success_chance_percent, requested_by, acquisition_channel_id, roll_phase,
      auto_delivery
    ) values (
      p_character_id, p_item_id, p_quantity, route_value, 'submitted',
      nullif(btrim(p_player_note), ''),
      case when item_row.acquisition_requires_roll
        then item_row.acquisition_success_percent else null end,
      auth.uid(), item_row.acquisition_channel_id,
      case when item_row.acquisition_requires_roll
        then 'contact_and_smuggling' else null end,
      false
    ) returning * into request_row;
  end if;

  insert into public.character_history (character_id, action, value, type)
  values (
    p_character_id,
    case
      when should_auto_fulfill then 'เบิกไอเท็ม'
      when should_schedule_delivery then 'สั่งจัดหาไอเท็ม'
      else 'ส่งคำร้องจัดหาไอเท็ม'
    end,
    item_row.name || ' ×' || p_quantity,
    'item_acquisition'
  );
  return request_row;
end;
$$;

create or replace function public.process_due_item_deliveries(
  p_character_id integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.item_acquisition_requests;
  item_row public.items;
  delivered_count integer := 0;
begin
  for request_row in
    select request.*
    from public.item_acquisition_requests request
    where request.character_id = p_character_id
      and request.auto_delivery
      and request.status = 'procuring'
      and not request.item_granted
      and request.available_at <= now()
    order by request.available_at
    for update skip locked
  loop
    select * into item_row from public.items where id = request_row.item_id;

    insert into public.character_inventory (character_id, item_name, quantity)
    values (request_row.character_id, item_row.name, request_row.quantity)
    on conflict (character_id, item_name)
    do update set quantity = public.character_inventory.quantity + excluded.quantity;

    insert into public.inventory_transactions (
      item_id, character_id, quantity_change, transaction_type, note
    ) values (
      request_row.item_id, request_row.character_id, -request_row.quantity,
      'purchase', 'จัดซื้อภายนอกครบกำหนดและส่งเข้าคลังอัตโนมัติ'
    );

    update public.item_acquisition_requests set
      status = 'completed',
      item_granted = true,
      completed_at = now(),
      updated_at = now()
    where id = request_row.id;

    insert into public.character_history (character_id, action, value, type)
    values (
      request_row.character_id,
      'รับไอเท็มที่จัดหาแล้ว',
      item_row.name || ' ×' || request_row.quantity,
      'item_acquisition'
    );
    delivered_count := delivered_count + 1;
  end loop;
  return delivered_count;
end;
$$;

drop function if exists public.get_player_item_acquisition_requests(integer);
create function public.get_player_item_acquisition_requests(
  p_character_id integer
)
returns table (
  id bigint,
  item_name text,
  quantity integer,
  request_route text,
  status text,
  staff_note text,
  charged_amount integer,
  resolution_roll integer,
  resolution_outcome text,
  roll_phase text,
  consequence text,
  acquisition_channel_name text,
  auto_delivery boolean,
  available_at timestamptz,
  submitted_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    request.id,
    item.name,
    request.quantity,
    request.request_route,
    request.status,
    request.staff_note,
    request.charged_amount,
    request.resolution_roll,
    request.resolution_outcome,
    request.roll_phase,
    request.consequence,
    channel.npc_name,
    request.auto_delivery,
    request.available_at,
    request.submitted_at,
    request.updated_at
  from public.item_acquisition_requests request
  join public.items item on item.id = request.item_id
  left join public.acquisition_channels channel
    on channel.id = request.acquisition_channel_id
  where request.character_id = p_character_id
  order by request.submitted_at desc
  limit 20;
$$;

create or replace function public.review_item_acquisition_request(
  p_request_id bigint,
  p_status text,
  p_staff_note text default null
)
returns public.item_acquisition_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.item_acquisition_requests;
  item_row public.items;
  character_row public.characters;
  total_cost integer;
  target_status text := p_status;
begin
  if not public.is_active_staff() then raise exception 'Staff access required'; end if;
  if p_status not in (
    'approved', 'awaiting_roll', 'procuring', 'ready', 'completed', 'rejected', 'cancelled'
  ) then raise exception 'Invalid acquisition status'; end if;

  select * into request_row from public.item_acquisition_requests
  where id = p_request_id for update;
  if not found then raise exception 'Acquisition request not found'; end if;
  if request_row.auto_delivery then
    raise exception 'Automatic delivery requests do not require staff review';
  end if;
  if request_row.status in ('completed', 'rejected', 'cancelled') then
    raise exception 'Acquisition request is already closed';
  end if;

  select * into item_row from public.items where id = request_row.item_id for update;
  select * into character_row from public.characters
    where id = request_row.character_id for update;
  total_cost := item_row.cost * request_row.quantity;

  if p_status in ('approved', 'awaiting_roll', 'procuring', 'ready', 'completed')
    and request_row.charged_currency is null then
    if coalesce(character_row.rp, 0) < total_cost then raise exception 'Insufficient RP'; end if;
    if item_row.is_limited and item_row.stock_quantity < request_row.quantity then
      raise exception 'Item is out of stock';
    end if;
    update public.characters set rp = coalesce(rp, 0) - total_cost
      where id = request_row.character_id;
    if item_row.is_limited then
      update public.items set stock_quantity = stock_quantity - request_row.quantity, updated_at = now()
      where id = request_row.item_id;
      request_row.stock_reserved := true;
    end if;
    request_row.charged_amount := total_cost;
    request_row.charged_currency := 'rp';
  end if;

  if p_status = 'approved' and item_row.acquisition_requires_roll then
    target_status := 'awaiting_roll';
  elsif p_status = 'approved' then
    target_status := 'procuring';
  end if;

  if p_status = 'completed' then
    if item_row.acquisition_requires_roll and (
      request_row.resolution_outcome is null
      or request_row.resolution_outcome not in ('success', 'critical_success')
    ) then raise exception 'A successful acquisition roll is required'; end if;
    insert into public.character_inventory (character_id, item_name, quantity)
    values (request_row.character_id, item_row.name, request_row.quantity)
    on conflict (character_id, item_name)
    do update set quantity = public.character_inventory.quantity + excluded.quantity;
    insert into public.inventory_transactions (
      item_id, character_id, quantity_change, transaction_type, note, created_by
    ) values (
      request_row.item_id, request_row.character_id, -request_row.quantity,
      'purchase', coalesce(nullif(btrim(p_staff_note), ''), 'จัดหาไอเท็มสำเร็จ'), auth.uid()
    );
    request_row.item_granted := true;
  end if;

  if p_status in ('rejected', 'cancelled') and request_row.charged_currency is not null then
    update public.characters set rp = coalesce(rp, 0) + request_row.charged_amount
      where id = request_row.character_id;
    if request_row.stock_reserved then
      update public.items set stock_quantity = stock_quantity + request_row.quantity, updated_at = now()
      where id = request_row.item_id;
    end if;
    request_row.charged_amount := 0;
    request_row.charged_currency := null;
    request_row.stock_reserved := false;
  end if;

  update public.item_acquisition_requests set
    status = target_status,
    staff_note = nullif(btrim(p_staff_note), ''),
    charged_currency = request_row.charged_currency,
    charged_amount = request_row.charged_amount,
    stock_reserved = request_row.stock_reserved,
    item_granted = request_row.item_granted,
    reviewed_by = auth.uid(),
    updated_at = now(),
    completed_at = case when target_status = 'completed' then now() else null end
  where id = p_request_id
  returning * into request_row;
  return request_row;
end;
$$;

revoke all on function public.submit_item_acquisition_request(integer, bigint, integer, text) from public;
revoke all on function public.process_due_item_deliveries(integer) from public;
revoke all on function public.get_player_item_acquisition_requests(integer) from public;
revoke all on function public.review_item_acquisition_request(bigint, text, text) from public;
grant execute on function public.submit_item_acquisition_request(integer, bigint, integer, text) to anon, authenticated;
grant execute on function public.process_due_item_deliveries(integer) to anon, authenticated;
grant execute on function public.get_player_item_acquisition_requests(integer) to anon, authenticated;
grant execute on function public.review_item_acquisition_request(bigint, text, text) to authenticated;

commit;
