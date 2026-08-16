-- Run after 20260815003000_unlock_npc_channels.sql.
-- The player initiates and rolls NPC negotiations. Supabase generates and
-- persists the roll once; staff handles hidden consequences separately.

begin;

alter table public.item_acquisition_requests
  add column if not exists staff_hidden_roll integer
    check (staff_hidden_roll between 1 and 100),
  add column if not exists staff_hidden_rolled_at timestamptz;

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
  rolled_value integer;
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

  insert into public.item_acquisition_requests (
    character_id,
    item_id,
    quantity,
    request_route,
    status,
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
    case when item_row.acquisition_requires_roll
      then item_row.acquisition_success_percent else null end,
    auth.uid(),
    item_row.acquisition_channel_id,
    case when item_row.acquisition_requires_roll then 'negotiation' else null end,
    false
  ) returning * into request_row;

  if item_row.acquisition_requires_roll then
    rolled_value := floor(random() * 100 + 1)::integer;
    outcome_value := case
      when rolled_value <= 5 then 'critical_success'
      when rolled_value <= item_row.acquisition_success_percent then 'success'
      when rolled_value >= 96 then 'critical_failure'
      else 'failure'
    end;

    if outcome_value in ('success', 'critical_success') then
      update public.characters
      set rp = coalesce(rp, 0) - total_cost
      where id = p_character_id;

      if item_row.is_limited then
        update public.items
        set stock_quantity = stock_quantity - p_quantity, updated_at = now()
        where id = p_item_id;
      end if;

      update public.item_acquisition_requests set
        status = 'procuring',
        charged_currency = 'rp',
        charged_amount = total_cost,
        stock_reserved = item_row.is_limited,
        resolution_roll = rolled_value,
        resolution_outcome = outcome_value,
        updated_at = now()
      where id = request_row.id
      returning * into request_row;
    else
      update public.item_acquisition_requests set
        status = 'risk_review',
        resolution_roll = rolled_value,
        resolution_outcome = outcome_value,
        updated_at = now()
      where id = request_row.id
      returning * into request_row;
    end if;
  else
    update public.characters
    set rp = coalesce(rp, 0) - total_cost
    where id = p_character_id;

    if item_row.is_limited then
      update public.items
      set stock_quantity = stock_quantity - p_quantity, updated_at = now()
      where id = p_item_id;
    end if;

    update public.item_acquisition_requests set
      charged_currency = 'rp',
      charged_amount = total_cost,
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
      || case when rolled_value is null then '' else ' · d100 = ' || rolled_value end,
    'item_acquisition'
  );

  return request_row;
end;
$$;

create or replace function public.roll_npc_purchase_hidden_result(
  p_request_id bigint
)
returns public.item_acquisition_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.item_acquisition_requests;
begin
  if not public.is_active_staff() then raise exception 'Staff access required'; end if;

  select * into request_row from public.item_acquisition_requests
  where id = p_request_id for update;
  if not found then raise exception 'Acquisition request not found'; end if;
  if request_row.request_route <> 'restricted_contact' then
    raise exception 'Request is not an NPC purchase';
  end if;
  if request_row.status not in ('risk_review', 'procuring') then
    raise exception 'Request is not ready for a hidden roll';
  end if;
  if request_row.staff_hidden_roll is not null then
    raise exception 'Hidden result was already rolled';
  end if;

  update public.item_acquisition_requests set
    staff_hidden_roll = floor(random() * 100 + 1)::integer,
    staff_hidden_rolled_at = now(),
    reviewed_by = auth.uid(),
    updated_at = now()
  where id = p_request_id
  returning * into request_row;

  return request_row;
end;
$$;

revoke all on function public.attempt_npc_item_purchase(integer, bigint, integer) from public;
revoke all on function public.roll_npc_purchase_hidden_result(bigint) from public;
grant execute on function public.attempt_npc_item_purchase(integer, bigint, integer)
  to anon, authenticated;
grant execute on function public.roll_npc_purchase_hidden_result(bigint)
  to authenticated;

commit;
