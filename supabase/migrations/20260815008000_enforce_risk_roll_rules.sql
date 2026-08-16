-- Run after 20260815007000_enable_npc_purchase_items.sql.
-- Replaces any previously deployed percentage-based NPC purchase function
-- with the agreed risk-level rules and repairs active false-positive results.

begin;

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

  update public.characters
  set rp = coalesce(rp, 0) - total_cost
  where id = p_character_id;

  insert into public.item_acquisition_requests (
    character_id, item_id, quantity, request_route, status,
    charged_currency, charged_amount, success_chance_percent, requested_by,
    acquisition_channel_id, roll_phase, auto_delivery
  ) values (
    p_character_id, p_item_id, p_quantity, 'restricted_contact',
    case when item_row.acquisition_requires_roll then 'submitted' else 'procuring' end,
    'rp', total_cost, null, auth.uid(), item_row.acquisition_channel_id,
    case
      when not item_row.acquisition_requires_roll then null
      when item_row.acquisition_risk_level <= 2 then 'opposed_negotiation'
      else 'target_negotiation'
    end,
    false
  ) returning * into request_row;

  if item_row.acquisition_requires_roll then
    -- The player initiates this RPC. The NPC opponent is generated only for
    -- low-risk attempts; higher risk uses a fixed target.
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

-- Correct active high-risk requests that the former percentage rule marked
-- successful even though their player result did not beat the fixed target.
do $$
declare
  bad_request record;
  required_target integer;
begin
  for bad_request in
    select request.*, item.acquisition_risk_level, item.name as item_name
    from public.item_acquisition_requests request
    join public.items item on item.id = request.item_id
    where request.request_route = 'restricted_contact'
      and request.status in ('procuring', 'ready')
      and request.resolution_outcome in ('success', 'critical_success')
      and request.resolution_roll is not null
      and item.acquisition_risk_level >= 3
  loop
    required_target := case bad_request.acquisition_risk_level
      when 3 then 50
      when 4 then 65
      else 80
    end;

    if bad_request.resolution_roll <= required_target then
      if bad_request.stock_reserved then
        update public.items
        set stock_quantity = stock_quantity + bad_request.quantity,
            updated_at = now()
        where id = bad_request.item_id;
      end if;

      update public.item_acquisition_requests
      set status = 'risk_review',
          resolution_outcome = case when bad_request.resolution_roll <= 5
            then 'critical_failure' else 'failure' end,
          stock_reserved = false,
          updated_at = now()
      where id = bad_request.id;

      insert into public.character_history (character_id, action, value, type)
      values (
        bad_request.character_id,
        'แก้ผลเจรจาตามเกณฑ์ความเสี่ยง',
        bad_request.item_name || ' · ผู้เล่น ' || bad_request.resolution_roll
          || ' ไม่เกินเกณฑ์ ' || required_target,
        'item_acquisition'
      );
    end if;
  end loop;
end;
$$;

revoke all on function public.attempt_npc_item_purchase(integer, bigint, integer) from public;
grant execute on function public.attempt_npc_item_purchase(integer, bigint, integer)
  to anon, authenticated;

commit;
