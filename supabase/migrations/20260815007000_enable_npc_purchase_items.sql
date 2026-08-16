-- Run after 20260815006000_allow_npc_roll_phases.sql.
-- Restricted items assigned to an active NPC are purchasable through that NPC.

begin;

update public.items item
set
  shop_available = true,
  price_currency = 'rp',
  auto_fulfill = false,
  updated_at = now()
where item.active
  and item.acquisition_type = 'restricted'
  and item.catalog_visibility <> 'staff_only'
  and item.acquisition_channel_id is not null
  and exists (
    select 1 from public.acquisition_channels channel
    where channel.id = item.acquisition_channel_id and channel.active
  );

-- Align the staff guidance with the rule that RP pays for the attempt.
update public.items
set failure_consequence = 'การเจรจาไม่สำเร็จ RP ที่ใช้ติดต่อไม่คืน และคำขอเข้าสู่การสรุปผลของทีมงาน'
where acquisition_type = 'restricted'
  and acquisition_requires_roll;

commit;
