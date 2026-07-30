begin;

-- ล้าง checklist และคำร้องใช้ไอเท็มทั้งหมด
delete from public.item_request_tasks;
delete from public.item_use_requests;

-- ล้างการอ้างถึงไอเท็มรางวัลเก่า แต่เก็บประวัติภารกิจผู้ติดตามไว้
update public.follower_explorations
set
  reward_item_id = null,
  reward_quantity = 0
where reward_item_id is not null;

-- ล้างประวัติการเปลี่ยนแปลงสต็อกและคลังของตัวละคร
delete from public.inventory_transactions;
delete from public.character_inventory;

-- ล้างประวัติกิจกรรมของตัวละครทั้งหมด
-- รวม RP, โปรดปราน, เลื่อนขั้น, ผู้ติดตาม, ร้านค้า และคำร้องใช้ไอเท็ม
-- การล้างนี้ไม่เปลี่ยนค่าปัจจุบันบนตาราง characters
delete from public.character_history;

-- ล้างแคตตาล็อกที่เว็บสต๊าฟและเว็บลูกมูใช้งานอยู่
delete from public.items;

-- ล้างตารางไอเท็มระบบเก่าด้วยถ้ายังมีอยู่
-- ป้องกัน migration เก่านำรายการเดิมกลับมาเพิ่มอีก
do $$
begin
  if to_regclass('public.item_master') is not null then
    execute 'delete from public.item_master';
  end if;
end;
$$;

commit;
