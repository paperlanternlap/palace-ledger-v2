-- Run after 20260815004000_player_roll_npc_purchases.sql.
-- Risk 1-2 uses an automatic opposed NPC d100 roll. Risk 3-5 uses a fixed
-- player target of >50, >65, and >80 respectively.
-- RP is the cost of attempting the negotiation and is not refunded on failure.

begin;

alter table public.item_acquisition_requests
  add column if not exists npc_opposed_roll integer
    check (npc_opposed_roll between 1 and 100);

create or replace function public.attempt_npc_item_purchase(
  p_character_id integer,
  p_item_id bigint,
  p_quantity integer default 1
)
returns public.item_acquisition_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  character_row public.characters;
  item_row public.items;
  request_row public.item_acquisition_requests;
  player_roll integer;
  npc_roll integer;
  target_roll integer;
  passed_roll boolean;
  outcome_value text;
  total_cost integer;
begin
  if p_quantity <= 0 then raise exception 'Quantity must be positive'; end if;

  select * into character_row from public.characters
  where id = p_character_id for update;
  if not found then raise exception 'Character not found'; end if;

  select * into item_row from public.items
  where id = p_item_id and active for update;
  if not found then raise exception 'Catalog item not found'; end if;
  if item_row.acquisition_type <> 'restricted' then
    raise exception 'Item is not sold by an NPC';
  end if;
  if item_row.catalog_visibility = 'staff_only' or not item_row.shop_available then
    raise exception 'Catalog item is not available';
  end if;
  if item_row.acquisition_channel_id is null then
    raise exception 'NPC acquisition channel is not configured';
  end if;
  if not exists (
    select 1 from public.character_acquisition_channel_unlocks acquaintance
    where acquaintance.character_id = p_character_id
      and acquaintance.acquisition_channel_id = item_row.acquisition_channel_id
  ) then
    raise exception 'NPC acquaintance is locked';
  end if;
  if coalesce(character_row.favor, 0) < item_row.minimum_favor then
    raise exception 'Insufficient Favor threshold';
  end if;
  if item_row.price_currency <> 'rp' then
    raise exception 'NPC acquisition must use RP';
  end if;
  if exists (
    select 1 from public.item_acquisition_requests active_request
    where active_request.character_id = p_character_id
      and active_request.item_id = p_item_id
      and active_request.request_route = 'restricted_contact'
      and active_request.status in (
        'submitted', 'approved', 'awaiting_roll', 'risk_review', 'procuring', 'ready'
      )
  ) then
    raise exception 'NPC purchase attempt is already active';
  end if;

  total_cost := item_row.cost * p_quantity;
  if coalesce(character_row.rp, 0) < total_cost then
    raise exception 'Insufficient RP';
  end if;
  if item_row.is_limited and item_row.stock_quantity < p_quantity then
    raise exception 'Item is out of stock';
  end if;

  -- RP pays for making the attempt, regardless of its outcome.
  update public.characters
  set rp = coalesce(rp, 0) - total_cost
  where id = p_character_id;

  insert into public.item_acquisition_requests (
    character_id,
    item_id,
    quantity,
    request_route,
    status,
    charged_currency,
    charged_amount,
    success_chance_percent,
    requested_by,
    acquisition_channel_id,
    roll_phase,
    auto_delivery
  ) values (
    p_character_id,
    p_item_id,
    p_quantity,
    'restricted_contact',
    case when item_row.acquisition_requires_roll then 'submitted' else 'procuring' end,
    'rp',
    total_cost,
    null,
    auth.uid(),
    item_row.acquisition_channel_id,
    case
      when not item_row.acquisition_requires_roll then null
      when item_row.acquisition_risk_level <= 2 then 'opposed_negotiation'
      else 'target_negotiation'
    end,
    false
  ) returning * into request_row;

  if item_row.acquisition_requires_roll then
    player_roll := floor(random() * 100 + 1)::integer;
    if item_row.acquisition_risk_level <= 2 then
      npc_roll := floor(random() * 100 + 1)::integer;
      target_roll := null;
      passed_roll := player_roll > npc_roll;
    else
      npc_roll := null;
      target_roll := case item_row.acquisition_risk_level
        when 3 then 50
        when 4 then 65
        else 80
      end;
      passed_roll := player_roll > target_roll;
    end if;

    outcome_value := case
      when player_roll <= 5 then 'critical_failure'
      when passed_roll and player_roll >= 96 then 'critical_success'
      when passed_roll then 'success'
      else 'failure'
    end;

    if outcome_value in ('success', 'critical_success') and item_row.is_limited then
      update public.items
      set stock_quantity = stock_quantity - p_quantity, updated_at = now()
      where id = p_item_id;
    end if;

    update public.item_acquisition_requests set
      status = case when outcome_value in ('success', 'critical_success')
        then 'procuring' else 'risk_review' end,
      stock_reserved = item_row.is_limited
        and outcome_value in ('success', 'critical_success'),
      resolution_roll = player_roll,
      npc_opposed_roll = npc_roll,
      resolution_outcome = outcome_value,
      updated_at = now()
    where id = request_row.id
    returning * into request_row;
  else
    if item_row.is_limited then
      update public.items
      set stock_quantity = stock_quantity - p_quantity, updated_at = now()
      where id = p_item_id;
    end if;

    update public.item_acquisition_requests set
      stock_reserved = item_row.is_limited,
      updated_at = now()
    where id = request_row.id
    returning * into request_row;
  end if;

  insert into public.character_history (character_id, action, value, type)
  values (
    p_character_id,
    case
      when not item_row.acquisition_requires_roll then 'เจรจาซื้อกับ NPC'
      when outcome_value in ('success', 'critical_success') then 'เจรจาซื้อสำเร็จ'
      else 'เจรจาซื้อไม่สำเร็จ'
    end,
    item_row.name || ' ×' || p_quantity
      || case when player_roll is null then ''
        when npc_roll is not null
          then ' · NPC ' || npc_roll || ' ต่อ ผู้เล่น ' || player_roll
        else ' · เกณฑ์มากกว่า ' || target_roll || ' · ผู้เล่น ' || player_roll
      end,
    'item_acquisition'
  );

  return request_row;
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
  npc_opposed_roll integer,
  acquisition_risk_level integer,
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
    request.npc_opposed_roll,
    item.acquisition_risk_level,
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
  keep_failed_attempt_charge boolean := false;
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
  keep_failed_attempt_charge := request_row.request_route = 'restricted_contact'
    and request_row.resolution_outcome in ('failure', 'critical_failure');

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

  if p_status in ('rejected', 'cancelled')
    and request_row.charged_currency is not null
    and not keep_failed_attempt_charge then
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

revoke all on function public.attempt_npc_item_purchase(integer, bigint, integer) from public;
revoke all on function public.get_player_item_acquisition_requests(integer) from public;
revoke all on function public.review_item_acquisition_request(bigint, text, text) from public;

grant execute on function public.attempt_npc_item_purchase(integer, bigint, integer)
  to anon, authenticated;
grant execute on function public.get_player_item_acquisition_requests(integer)
  to anon, authenticated;
grant execute on function public.review_item_acquisition_request(bigint, text, text)
  to authenticated;

commit;
