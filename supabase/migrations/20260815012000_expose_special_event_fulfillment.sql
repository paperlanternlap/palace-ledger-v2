begin;

-- The player catalog must expose how an item is fulfilled so special-event
-- rewards can use the existing purchase flow that deducts RP or Favor and
-- creates an item-use request for staff.
drop function if exists public.get_player_item_catalog(integer);

create function public.get_player_item_catalog(
  p_character_id integer
)
returns table (
  id bigint,
  name text,
  description text,
  cost integer,
  price_currency text,
  fulfillment_type text,
  acquisition_type text,
  catalog_visibility text,
  acquisition_requires_roll boolean,
  minimum_favor integer,
  fulfillment_days_min integer,
  fulfillment_days_max integer,
  is_limited boolean,
  stock_quantity integer,
  use_category text,
  acquisition_channel_id bigint,
  unlocked boolean,
  can_request boolean,
  action_label text,
  acquisition_channel_name text,
  acquisition_channel_role text,
  acquisition_channel_access_reason text,
  acquisition_channel_motivation text,
  acquisition_unlock_method text,
  acquisition_risk_summary text,
  acquisition_risk_level integer
)
language sql
security definer
set search_path = public
stable
as $$
  with character_row as (
    select
      character.id,
      character.position,
      coalesce(character.favor, 0) as favor,
      coalesce(privilege.can_command_external_purchase, false) as can_command
    from public.characters character
    left join public.character_position_acquisition_privileges privilege
      on privilege.position = character.position
    where character.id = p_character_id
  ), catalog as (
    select
      item.*,
      character_row.favor as character_favor,
      character_row.can_command,
      channel.npc_name,
      channel.npc_role,
      channel.access_reason,
      channel.motivation,
      channel.unlock_method,
      channel.risk_summary,
      case
        when item.acquisition_type = 'restricted'
          then channel_unlock.id is not null
        when item.catalog_visibility = 'locked'
          then item_unlock.id is not null
        else true
      end as access_unlocked
    from public.items item
    cross join character_row
    left join public.character_acquisition_channel_unlocks channel_unlock
      on channel_unlock.character_id = character_row.id
      and channel_unlock.acquisition_channel_id = item.acquisition_channel_id
    left join public.character_catalog_unlocks item_unlock
      on item_unlock.character_id = character_row.id
      and item_unlock.item_id = item.id
    left join public.acquisition_channels channel
      on channel.id = item.acquisition_channel_id and channel.active
    where item.active
      and item.catalog_visibility <> 'staff_only'
      and (
        item.shop_available
        or item.acquisition_type = 'story_only'
        or item.catalog_visibility = 'locked'
      )
  )
  select
    catalog.id,
    case when not catalog.access_unlocked
      then 'ผู้ติดต่อที่ยังไม่รู้จัก' else catalog.name end,
    case when not catalog.access_unlocked
      then 'ต้องพบเบาะแสหรือสร้างความไว้วางใจกับ NPC ก่อนจึงจะเห็นสิ่งที่เขาจัดหาได้'
      else catalog.description end,
    catalog.cost,
    catalog.price_currency,
    catalog.fulfillment_type,
    catalog.acquisition_type,
    catalog.catalog_visibility,
    catalog.acquisition_requires_roll,
    catalog.minimum_favor,
    case
      when catalog.acquisition_type = 'external_legal' and catalog.can_command
        then greatest(0, catalog.fulfillment_days_min - 1)
      else catalog.fulfillment_days_min
    end,
    case
      when catalog.acquisition_type = 'external_legal' and catalog.can_command
        then greatest(
          greatest(0, catalog.fulfillment_days_min - 1),
          catalog.fulfillment_days_max - 2
        )
      else catalog.fulfillment_days_max
    end,
    catalog.is_limited,
    catalog.stock_quantity,
    catalog.use_category,
    catalog.acquisition_channel_id,
    catalog.access_unlocked,
    case
      when catalog.acquisition_type = 'story_only' then false
      when not catalog.access_unlocked then false
      when catalog.character_favor < catalog.minimum_favor then false
      when catalog.is_limited and catalog.stock_quantity <= 0 then false
      else true
    end,
    case
      when catalog.acquisition_type = 'story_only' then 'ได้รับจากการสำรวจเท่านั้น'
      when not catalog.access_unlocked then 'ยังไม่รู้จัก NPC'
      when catalog.character_favor < catalog.minimum_favor then 'โปรดปรานยังไม่ถึงเกณฑ์'
      when catalog.fulfillment_type = 'staff_request' then 'แลกสิทธิ์เหตุการณ์'
      when catalog.acquisition_type = 'palace_stock' then 'เบิกจากคลัง'
      when catalog.acquisition_type = 'external_legal' and catalog.can_command
        then 'ออกคำสั่งให้จัดซื้อ'
      when catalog.acquisition_type = 'external_legal' then 'ส่งคำขอจัดซื้อ'
      when catalog.acquisition_type = 'restricted' then 'เจรจาซื้อ'
      else 'ไม่สามารถขอได้'
    end,
    case when catalog.access_unlocked then catalog.npc_name else null end,
    case when catalog.access_unlocked then catalog.npc_role else null end,
    case when catalog.access_unlocked then catalog.access_reason else null end,
    case when catalog.access_unlocked then catalog.motivation else null end,
    case when catalog.access_unlocked then catalog.unlock_method else null end,
    case when catalog.access_unlocked then catalog.risk_summary else null end,
    catalog.acquisition_risk_level
  from catalog
  order by
    case catalog.acquisition_type
      when 'palace_stock' then 1
      when 'external_legal' then 2
      when 'restricted' then 3
      else 4
    end,
    catalog.npc_name nulls last,
    catalog.name;
$$;

revoke all on function public.get_player_item_catalog(integer) from public;
grant execute on function public.get_player_item_catalog(integer) to anon, authenticated;

commit;
