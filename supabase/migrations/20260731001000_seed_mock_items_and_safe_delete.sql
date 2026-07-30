insert into public.items (
  name,
  description,
  cost,
  price_currency,
  fulfillment_type,
  shop_available,
  is_limited,
  stock_quantity,
  low_stock_threshold,
  active,
  use_category,
  default_channel,
  requires_target,
  requires_roll,
  action_template
)
values
  (
    'ห่อยาสมุนไพรชั้นดี',
    'ยาสมุนไพรจากกองโอสถ ใช้ประกอบฉากรักษาอาการบาดเจ็บหรือเจ็บป่วย',
    0, 'rp', 'inventory', false, true, 20, 5, true,
    'medicine', 'กองโอสถ', true, false, '[]'::jsonb
  ),
  (
    'ตราผ่านทางวังชั้นใน',
    'ตราชั่วคราวสำหรับเปิดทางเข้าสู่พื้นที่หวงห้ามตามเหตุการณ์ที่แม่งานกำหนด',
    0, 'rp', 'inventory', false, true, 8, 2, true,
    'access', 'ประตูวังหน้า–วังหลัง', false, false, '[]'::jsonb
  ),
  (
    'แผนผังทางลับ',
    'แผนผังเก่าที่อาจเปิดเบาะแส เส้นทาง หรือเหตุการณ์ลับภายในวัง',
    0, 'rp', 'staff_request', false, true, 5, 2, true,
    'secret', 'ทางลับ', false, true,
    '[{"label":"กำหนดเบาะแสหรือเส้นทางที่ค้นพบ","type":"staff_action"}]'::jsonb
  ),
  (
    'จดหมายปิดผนึก',
    'จดหมายไม่ระบุผู้ส่ง ใช้เป็นจุดเริ่มต้นของข่าวลือ ภารกิจ หรือเหตุการณ์ใหม่',
    0, 'rp', 'staff_request', false, false, 0, 0, true,
    'story', 'ข่าวสาร', true, false,
    '[{"label":"ระบุเนื้อหาและผู้เกี่ยวข้องในจดหมาย","type":"staff_action"}]'::jsonb
  ),
  (
    'ถุงเงินรางวัล',
    'เงินรางวัลเล็กน้อยจากการทำภารกิจสำเร็จ ใช้เป็นของประกอบเนื้อเรื่อง',
    0, 'rp', 'inventory', false, false, 0, 0, true,
    'general', 'รางวัลภารกิจ', false, false, '[]'::jsonb
  ),
  (
    'ผ้าไหมลายเมฆ',
    'ผ้าไหมคุณภาพดีจากคลังเครื่องแต่งกาย เหมาะสำหรับมอบเป็นรางวัลหรือของกำนัล',
    0, 'rp', 'inventory', false, true, 12, 3, true,
    'general', 'คลังเครื่องแต่งกาย', false, false, '[]'::jsonb
  ),
  (
    'ปิ่นหยกขาว',
    'เครื่องประดับหยกเนื้อดี ใช้เป็นรางวัล ของกำนัล หรือหลักฐานในเหตุการณ์',
    0, 'rp', 'inventory', false, true, 6, 2, true,
    'general', 'เครื่องประดับ', false, false, '[]'::jsonb
  ),
  (
    'ตำรับยาหายาก',
    'บันทึกตำรับยาที่อาจนำไปสู่ภารกิจค้นหาวัตถุดิบหรือการรักษาพิเศษ',
    0, 'rp', 'staff_request', false, true, 4, 1, true,
    'medicine', 'กองโอสถ', true, false,
    '[{"label":"กำหนดผลของตำรับยา","type":"staff_action"}]'::jsonb
  ),
  (
    'เบาะแสลับจากวังหลัง',
    'ข่าวสารที่รวบรวมได้จากภารกิจสำรวจ ใช้ต่อยอดโรลหรือเปิดเหตุการณ์ใหม่',
    0, 'rp', 'staff_request', false, false, 0, 0, true,
    'secret', 'วังหลัง', true, false,
    '[{"label":"เขียนรายละเอียดเบาะแสให้ผู้เล่น","type":"staff_action"}]'::jsonb
  ),
  (
    'เครื่องรางคุ้มภัย',
    'เครื่องรางสำหรับใช้ประกอบโรลป้องกันภัยหรือบรรเทาผลจากเหตุการณ์',
    0, 'favor', 'inventory', false, true, 10, 3, true,
    'defense', 'วัดจันทร์เสี้ยว', true, true, '[]'::jsonb
  )
on conflict (name) do nothing;

create or replace function public.delete_catalog_item(
  p_item_id bigint
)
returns void
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

  select * into target_item
  from public.items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Item not found';
  end if;

  if exists (
    select 1 from public.inventory_transactions
    where item_id = p_item_id
  ) or exists (
    select 1 from public.item_use_requests
    where item_id = p_item_id
  ) or exists (
    select 1 from public.follower_explorations
    where reward_item_id = p_item_id
  ) or exists (
    select 1 from public.character_inventory
    where item_name = target_item.name
  ) then
    raise exception 'Item has usage history; deactivate it instead';
  end if;

  delete from public.items
  where id = p_item_id;
end;
$$;

revoke all on function public.delete_catalog_item(bigint) from public;
grant execute on function public.delete_catalog_item(bigint)
  to authenticated;
