-- Map exploration uses the existing staff roll / resolution / inventory workflow.
-- No automatic payouts and no changes to the legacy follower weekly allowance.
begin;

alter table public.exploration_locations
  add column if not exists map_label text,
  add column if not exists self_character_ids integer[] not null default '{}';
create unique index if not exists exploration_locations_map_label
  on public.exploration_locations(map_label) where map_label is not null;

create table if not exists public.exploration_settings (
  id boolean primary key default true check (id),
  round_number integer not null default 1 check (round_number > 0)
);
insert into public.exploration_settings(id) values (true) on conflict (id) do nothing;
alter table public.exploration_settings enable row level security;
drop policy if exists "Read exploration round" on public.exploration_settings;
create policy "Read exploration round" on public.exploration_settings
  for select to anon, authenticated using (true);
drop policy if exists "Staff update exploration round" on public.exploration_settings;
create policy "Staff update exploration round" on public.exploration_settings
  for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff());
grant select on public.exploration_settings to anon, authenticated;
grant update on public.exploration_settings to authenticated;

alter table public.follower_explorations
  alter column follower_id drop not null,
  add column if not exists exploration_round integer,
  add column if not exists request_id uuid;
create unique index if not exists exploration_request_id on public.follower_explorations(request_id);
create unique index if not exists self_exploration_one_active
  on public.follower_explorations(character_id) where follower_id is null and status = 'exploring';
create unique index if not exists self_exploration_one_per_round
  on public.follower_explorations(character_id, exploration_round)
  where follower_id is null and status <> 'cancelled';

create or replace function public.get_player_exploration_map(p_character_id integer)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(
    (to_jsonb(l) - 'self_character_ids') || jsonb_build_object('can_explore_self',
      p_character_id = any(l.self_character_ids)
      and not exists (select 1 from public.follower_explorations m
        where m.character_id = p_character_id and m.follower_id is null
          and m.status <> 'cancelled'
          and (m.status = 'exploring' or m.exploration_round = s.round_number)))
    order by l.sort_order), '[]'::jsonb)
  from public.exploration_locations l cross join public.exploration_settings s
  where l.active;
$$;

create or replace function public.start_map_exploration(
  p_character_id integer, p_location_id bigint, p_request_id uuid,
  p_follower_id bigint default null
)
returns public.follower_explorations
language plpgsql security definer set search_path = public as $$
declare
  place public.exploration_locations;
  person public.follower_master;
  mission public.follower_explorations;
  current_round integer;
begin
  if p_request_id is null then raise exception 'Request id required'; end if;
  -- Serializes starts for this character, including retries from multiple tabs.
  perform 1 from public.characters where id = p_character_id for update;
  if not found then raise exception 'Character not available'; end if;
  select * into mission from public.follower_explorations where request_id = p_request_id;
  if found then
    if mission.character_id <> p_character_id or mission.location_id <> p_location_id
      or mission.follower_id is distinct from p_follower_id then
      raise exception 'Request does not match original exploration';
    end if;
    mission.result_details := null;
    return mission;
  end if;

  select * into place from public.exploration_locations where id = p_location_id and active for share;
  if not found then raise exception 'Exploration location not available'; end if;

  if p_follower_id is not null then
    select * into person from public.follower_master where id = p_follower_id for update;
    if not found or not person.active or person.owner_character_id is distinct from p_character_id then
      raise exception 'Follower not available';
    end if;
    -- The established RPC enforces access, idle status, talents and weekly limit.
    mission := public.start_follower_exploration(p_character_id, p_follower_id, p_location_id, 'สำรวจและจัดหาของใช้');
    update public.follower_explorations set request_id = p_request_id where id = mission.id returning * into mission;
    mission.result_details := null;
    return mission;
  end if;

  if not (p_character_id = any(place.self_character_ids)) then raise exception 'Location access required'; end if;
  select round_number into current_round from public.exploration_settings where id for share;
  if current_round is null then raise exception 'Exploration round not available'; end if;
  if exists (select 1 from public.follower_explorations where character_id = p_character_id
      and follower_id is null and status = 'exploring') then raise exception 'An active exploration already exists'; end if;
  if exists (select 1 from public.follower_explorations where character_id = p_character_id
      and follower_id is null and exploration_round = current_round and status <> 'cancelled') then
    raise exception 'Exploration round limit reached';
  end if;
  insert into public.follower_explorations(character_id, follower_id, location_id, destination,
    objective, suitability_percent, exploration_round, request_id)
  values (p_character_id, null, place.id, place.name, 'สำรวจและจัดหาของใช้', 0, current_round, p_request_id)
  returning * into mission;
  insert into public.character_history(character_id, action, value, type)
    values(p_character_id, 'ออกสำรวจด้วยตัวเอง', place.name, 'follower_mission');
  return mission;
end;
$$;

-- Guard the existing resolver too: it remains the only way to issue rewards.
create or replace function public.validate_map_exploration_resolution()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'completed' and old.status = 'exploring' and new.request_id is not null then
    if new.reward_item_id is not null and new.resolution_outcome not in ('success', 'critical_success') then
      raise exception 'Failed exploration cannot grant a reward';
    end if;
    if new.reward_quantity > 1 then raise exception 'Map exploration grants at most one item'; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists validate_map_exploration_resolution on public.follower_explorations;
create trigger validate_map_exploration_resolution before update of status on public.follower_explorations
  for each row execute function public.validate_map_exploration_resolution();

create or replace function public.resolve_follower_exploration(
  p_mission_id bigint,
  p_result_summary text,
  p_result_details text default null,
  p_reward_item_id bigint default null,
  p_reward_quantity integer default 0
)
returns public.follower_explorations
language plpgsql
security definer
set search_path = public
as $$
declare
  mission_row public.follower_explorations;
  follower_row public.follower_master;
  reward_item public.items;
  reward_text text := '';
begin
  if not public.is_active_staff() then
    raise exception 'Staff access required';
  end if;

  if nullif(trim(p_result_summary), '') is null then
    raise exception 'Result summary is required';
  end if;

  if p_reward_quantity < 0
    or (p_reward_item_id is null and p_reward_quantity > 0)
    or (p_reward_item_id is not null and p_reward_quantity <= 0) then
    raise exception 'Invalid reward quantity';
  end if;

  select * into mission_row
  from public.follower_explorations
  where id = p_mission_id
  for update;

  if not found or mission_row.status <> 'exploring' then
    raise exception 'Active exploration not found';
  end if;

  select * into follower_row
  from public.follower_master
  where id = mission_row.follower_id
  for update;

  if p_reward_item_id is not null then
    select * into reward_item
    from public.items
    where id = p_reward_item_id and active
    for update;

    if not found then
      raise exception 'Active reward item not found';
    end if;

    if reward_item.is_limited then
      if reward_item.stock_quantity < p_reward_quantity then
        raise exception 'Insufficient reward stock';
      end if;

      update public.items
      set
        stock_quantity = stock_quantity - p_reward_quantity,
        updated_at = now()
      where id = reward_item.id;
    end if;

    insert into public.character_inventory (
      character_id,
      item_name,
      quantity
    )
    values (
      mission_row.character_id,
      reward_item.name,
      p_reward_quantity
    )
    on conflict (character_id, item_name)
    do update set quantity =
      public.character_inventory.quantity + excluded.quantity;

    insert into public.inventory_transactions (
      item_id,
      character_id,
      quantity_change,
      transaction_type,
      note,
      created_by
    )
    values (
      reward_item.id,
      mission_row.character_id,
      -p_reward_quantity,
      'grant',
      'รางวัลจากภารกิจผู้ติดตาม: ' || trim(p_result_summary),
      auth.uid()
    );

    reward_text := ' · ได้รับ ' || reward_item.name ||
      ' ×' || p_reward_quantity;
  end if;

  update public.follower_explorations
  set
    status = 'completed',
    result_summary = trim(p_result_summary),
    result_details = nullif(trim(p_result_details), ''),
    reward_item_id = p_reward_item_id,
    reward_quantity = p_reward_quantity,
    completed_at = now(),
    resolved_by = auth.uid()
  where id = p_mission_id
  returning * into mission_row;

  update public.follower_master
  set status = 'idle', updated_at = now()
  where id = mission_row.follower_id;

  insert into public.character_history (
    character_id,
    action,
    value,
    type
  )
  values (
    mission_row.character_id,
    coalesce(follower_row.name, (select character_name from public.characters where id = mission_row.character_id)) || ' กลับจากสำรวจ',
    trim(p_result_summary) || reward_text,
    'follower_result'
  );

  return mission_row;
end;
$$;


revoke all on function public.get_player_exploration_map(integer) from public;
revoke all on function public.start_map_exploration(integer, bigint, uuid, bigint) from public;
grant execute on function public.get_player_exploration_map(integer) to anon, authenticated;
grant execute on function public.start_map_exploration(integer, bigint, uuid, bigint) to anon, authenticated;

-- Staff notes must not be included in the player response.
-- Deployed versions may have different OUT columns. Replace atomically, without CASCADE.
drop function if exists public.get_player_follower_explorations(integer);
create or replace function public.get_player_follower_explorations(
  p_character_id integer
)
returns table (
  id bigint,
  follower_id bigint,
  destination text,
  objective text,
  status text,
  result_summary text,
  result_details text,
  reward_item_name text,
  reward_quantity integer,
  started_at timestamptz,
  completed_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    mission.id,
    mission.follower_id,
    mission.destination,
    mission.objective,
    mission.status,
    mission.result_summary,
    null::text,
    reward.name,
    mission.reward_quantity,
    mission.started_at,
    mission.completed_at
  from public.follower_explorations mission
  left join public.items reward on reward.id = mission.reward_item_id
  where mission.character_id = p_character_id
  order by mission.started_at desc
  limit 30;
$$;


revoke all on function public.get_player_follower_explorations(integer) from public;
grant execute on function public.get_player_follower_explorations(integer) to anon, authenticated;

commit;

begin;
-- Import only map descriptions; no access or item economy is inferred from the draft.
do $seed$
declare point jsonb; free_zone integer;
begin
  for point in select value from jsonb_array_elements($map$[{"label":"1","name":"ท้องพระโรงไท่เหอ","code":"taihe_hall","category":"ราชพิธีวังหน้า","summary":"โถงใหญ่เหนือฐานหิน รายชื่อเข้าเฝ้าและลำดับขบวนอาจบอกความเคลื่อนไหวของราชสำนัก","layer":"buildings","x":49.8,"y":83},{"label":"2","name":"ตำหนักฉินเจิ้ง","code":"qinzhen_palace","category":"ราชการวังหน้า","summary":"ตำหนักทรงงานที่มีฎีกาและผู้ถือเอกสารเดินเข้าออกตลอดวัน","layer":"buildings","x":49.8,"y":65},{"label":"3","name":"ตำหนักเฉิงหมิง","code":"chengming_palace","category":"พระราชฐานส่วนพระองค์","summary":"ลานสงบและระเบียงไม้เชื่อมเรือนรับรองกับพื้นที่ทรงงาน","layer":"buildings","x":50,"y":50},{"label":"4","name":"ตำหนักคุนหนิง","code":"kunning_palace","category":"ตำหนักฝ่ายใน","summary":"ตำหนักประทับของฮองเฮาและศูนย์กลางกิจการฝ่ายใน ลานรับรองมีผู้มาถวายพระพรและส่งรายงาน","layer":"buildings","x":49.7,"y":38.8},{"label":"5","name":"ตำหนักโซ่วอัน","code":"shouan_palace","category":"ตำหนักฝ่ายใน","summary":"เรือนเก่าใต้ร่มไม้ใหญ่ มีกลิ่นชาและเครื่องหอมอย่างสงบ","layer":"buildings","x":49.8,"y":13.3},{"label":"6.1","name":"ตำหนักหย่งหวา","code":"yonghua_palace","category":"ตำหนักพระสนมเอก","summary":"ลานกว้างและเรือนข้างหลายหลังรองรับการส่งของประจำวัน","layer":"buildings","x":30.6,"y":24.7},{"label":"6.2","name":"ตำหนักจาวเต๋อ","code":"zhaode_palace","category":"ตำหนักพระสนมเอก","summary":"ระเบียงร่มไม้และพื้นหินชื้นหลังฝน เหมาะแก่การสนทนาเงียบ ๆ","layer":"buildings","x":35.3,"y":41.2},{"label":"6.3","name":"ตำหนักจิ่งเหอ","code":"jinghe_palace","category":"ตำหนักพระสนมเอก","summary":"ลานเปิดรับแสง มองเห็นการเดินข้ามเรือนได้ชัด","layer":"buildings","x":68.8,"y":24.5},{"label":"6.4","name":"ตำหนักฉางหนิง","code":"changning_palace","category":"ตำหนักพระสนมเอก","summary":"แนวไผ่บังเรือนด้านใน ข้างนอกมีคนส่งสำรับและเครื่องใช้","layer":"buildings","x":67.3,"y":41.2},{"label":"7","name":"จิ่วฮวากง","code":"jiuhua_compound","category":"หมู่ตำหนักฝ่ายใน","summary":"หมู่ตำหนักเก้าหลังใช้สวนกลางร่วมกัน มีเสียงดนตรีและการพบปะ","layer":"buildings","x":18.8,"y":39.5},{"label":"8","name":"อี๋ฟางหย่วน","code":"yifang_compound","category":"หมู่เรือนฝ่ายใน","summary":"เรือนพักห้าหลังล้อมสวนร่วม มีงานเย็บปักและน้ำชา","layer":"buildings","x":83.5,"y":19.2},{"label":"9","name":"หนิงฟางหย่วน","code":"ningfang_compound","category":"หมู่เรือนฝ่ายใน","summary":"ลานร่วมของเรือนพักที่มีผู้คนผลัดกันทำกิจวัตรตลอดวัน","layer":"buildings","x":84.9,"y":36},{"label":"10","name":"ตำหนักจิ้งโหยว","code":"jingyou_palace","category":"เขตควบคุมฝ่ายใน","summary":"ตำหนักเย็นที่ดูแลเท่าจำเป็น มีห้องปิดและทางเดินเงียบ","layer":"buildings","x":17.8,"y":19},{"label":"11","name":"เรือนพักของนางกำนัล","code":"maid_quarters","category":"ที่พักข้ารับใช้","summary":"เรือนพักรวมกับลานซักล้าง มีคนผลัดเวรตั้งแต่ก่อนฟ้าสาง","layer":"buildings","x":86.7,"y":53},{"label":"12","name":"ตำหนักหลิงฮวา","code":"linghua_palace","category":"ตำหนักว่างฝ่ายใน","summary":"ตำหนักพร้อมใช้งานที่ยังไม่มีผู้ประทับ มีคนตรวจและทำความสะอาดตามรอบ","layer":"buildings","x":32.4,"y":51.2},{"label":"13","name":"เรือนพักของขันที","code":"eunuch_quarters","category":"ที่พักข้ารับใช้","summary":"เรือนพักใกล้ทางบริการ มีคนรับคำสั่งและผลัดเวรตลอดวัน","layer":"buildings","x":16.9,"y":61.2},{"label":"14","name":"สวนหลวงเหลียนอิ่ง","code":"lianying_garden","category":"สวนฝ่ายใน","summary":"สวนรอบสระและศาลาหลิงปัว เชื่อมฝั่งด้วยสะพาน มีศาลาทิงเฟิงริมน้ำ","layer":"buildings","x":53.4,"y":27.8},{"label":"15","name":"กองโอสถฝ่ายในและสวนสมุนไพรหลวง","code":"medical_bureau","category":"กองงานฝ่ายใน","summary":"กลิ่นยาต้มลอยจากห้องตรวจไปยังสวนสมุนไพรและจุดชั่งยา","layer":"buildings","x":68.5,"y":47.5},{"label":"16","name":"ห้องเครื่องและคลังเสบียงวังหลัง","code":"inner_kitchen","category":"กองงานฝ่ายใน","summary":"เตาไฟและลานรับวัตถุดิบคึกคักก่อนมื้ออาหาร มีจุดจัดสำรับ","layer":"buildings","x":75.6,"y":48},{"label":"17","name":"กองภูษาและลานซักล้าง","code":"textile_bureau","category":"กองงานฝ่ายใน","summary":"โต๊ะตัดเย็บและราวตากผ้าเรียงตามลาน งานเร่งขึ้นเมื่อฝนมา","layer":"buildings","x":90.8,"y":48.8},{"label":"18","name":"ห้องเครื่องวังหน้า","code":"outer_kitchen","category":"กองงานวังหน้า","summary":"ครัวใหญ่เตรียมอาหารรับราชการและพระราชพิธี มีลานรับของ","layer":"buildings","x":32.3,"y":61},{"label":"19","name":"กรมทหารองครักษ์และเรือนพักองครักษ์","code":"guard_bureau","category":"รักษาการ","summary":"ลานรวมพลและกระดานเวรเชื่อมเรือนพักของผู้ผลัดรักษาการ","layer":"buildings","x":17.3,"y":76.5},{"label":"20","name":"ลานฝึกและคลังอาวุธ","code":"training_armory","category":"รักษาการ","summary":"ลานฝึกมีหุ่นและเป้า ส่วนคลังข้างลานเบิกคืนเป็นรายการ","layer":"buildings","x":32.2,"y":76.2},{"label":"21","name":"โรงเกวียนและคอกม้าหลวง","code":"royal_stables","category":"กองงานวังหน้า","summary":"เสียงกีบม้าและกลิ่นหนังรอบลานเตรียมพาหนะของราชสำนัก","layer":"buildings","x":13.1,"y":87.2},{"label":"22","name":"เรือนควบคุมและทางเข้าคุกหลวง","code":"prison_entry","category":"เขตควบคุมวังหน้า","summary":"จุดลงทะเบียนและตรวจค้นก่อนบันไดลงสู่ห้องคุมขัง","layer":"buildings","x":23.8,"y":87.2},{"label":"23","name":"กรมตุลาการและศาลหลวง","code":"justice_bureau","category":"ราชการวังหน้า","summary":"ห้องรับเรื่องนำเข้าสู่ห้องสอบสวนและชั้นสำนวน","layer":"buildings","x":33,"y":87},{"label":"24","name":"ลานเฉิงอี้","code":"chengyi_court","category":"พื้นที่กลางวังหน้า","summary":"ลานหินเปิดกว้างสำหรับรอเข้าเฝ้าและจัดขบวนตามยศ","layer":"buildings","x":49.9,"y":73},{"label":"25","name":"ตำหนักจิ้งเทียน","code":"jingtian_palace","category":"พิธีและศาสตร์โบราณ","summary":"โถงธูปและห้องตำราฤกษ์ยาม มีลานสังเกตดวงดาวด้านหลัง","layer":"buildings","x":69.6,"y":60.8},{"label":"26","name":"สำนักแพทย์หลวง","code":"royal_medical","category":"ราชการวังหน้า","summary":"สำนักรักษาและปรุงยาที่มีผู้มารอตรวจตั้งแต่เช้า","layer":"buildings","x":88,"y":61.8},{"label":"27","name":"กรมประคองและทะเบียน","code":"registry_bureau","category":"ราชการวังหน้า","summary":"ชั้นทะเบียนและโต๊ะคัดสำเนานำไปสู่ห้องเอกสารเก่าที่จำกัดผู้เข้า","layer":"buildings","x":71.2,"y":76.5},{"label":"28","name":"กรมคลังและคลังหลวง","code":"treasury","category":"ราชการวังหน้า","summary":"สำนักงานบัญชีอยู่หน้าคลังแน่นหนา ทุกการเบิกต้องตรวจนับ","layer":"buildings","x":88.4,"y":76.6},{"label":"29","name":"กรมพิธีการ","code":"rites_bureau","category":"ราชการวังหน้า","summary":"โต๊ะกำหนดขบวนและคลังเครื่องประกอบพิธีเตรียมงานของราชสำนัก","layer":"buildings","x":65.4,"y":87.5},{"label":"30","name":"กรมโยธาและงานช่าง","code":"works_bureau","category":"กองงานวังหน้า","summary":"โรงช่างและเรือนเพาะชำดูแลอาคาร สวน และทางระบายน้ำ","layer":"buildings","x":75.7,"y":86.8},{"label":"31","name":"เรือนรับรองอวี้ถัง","code":"yutang_guesthouse","category":"รับรองวังหน้า","summary":"เรือนน้ำชาสำหรับขุนนางและแขกรอเรียกเข้าเฝ้า","layer":"buildings","x":82,"y":86.8},{"label":"32","name":"สวนหมิงกวง","code":"mingguang_garden","category":"สวนวังหน้า","summary":"ทางกว้างรอบสระและศาลาสวนวังหน้า เหมาะแก่พักระหว่างราชกิจ","layer":"buildings","x":90.7,"y":86.9},{"label":"A","name":"ประตูเจิ้งหยาง","code":"gate_a","category":"ประตูและจุดตรวจ","summary":"จุดรักษาการใต้กลางของแผนที่ มีการตรวจคนและผลัดเวรตามหน้าที่","layer":"gates","x":49.8,"y":92.3},{"label":"B","name":"ประตูตงอัน","code":"gate_b","category":"ประตูและจุดตรวจ","summary":"จุดรักษาการใต้ฝั่งซ้ายภาพของแผนที่ มีการตรวจคนและผลัดเวรตามหน้าที่","layer":"gates","x":24.6,"y":92.4},{"label":"C","name":"ประตูซีหวา","code":"gate_c","category":"ประตูและจุดตรวจ","summary":"จุดรักษาการใต้ฝั่งขวาภาพของแผนที่ มีการตรวจคนและผลัดเวรตามหน้าที่","layer":"gates","x":75.8,"y":92.4},{"label":"D","name":"ป้อมมุมตะวันออก","code":"gate_d","category":"ป้อมรักษาการ","summary":"จุดรักษาการมุมล่างขวาของแผนที่ มีการตรวจคนและผลัดเวรตามหน้าที่","layer":"gates","x":96.9,"y":91.8},{"label":"E","name":"ประตูตะวันออกและสะพาน","code":"gate_e","category":"ประตูและจุดตรวจ","summary":"จุดรักษาการขวากลางของแผนที่ มีการตรวจคนและผลัดเวรตามหน้าที่","layer":"gates","x":96.7,"y":55.3},{"label":"F","name":"ป้อมมุมตะวันออกเฉียงเหนือ","code":"gate_f","category":"ป้อมรักษาการ","summary":"จุดรักษาการมุมบนขวาของแผนที่ มีการตรวจคนและผลัดเวรตามหน้าที่","layer":"gates","x":96.4,"y":6.1},{"label":"G","name":"ประตูเหนือและสะพาน","code":"gate_g","category":"ประตูและจุดตรวจ","summary":"จุดรักษาการบนค่อนไปทางซ้ายของแผนที่ มีการตรวจคนและผลัดเวรตามหน้าที่","layer":"gates","x":23.6,"y":6.3},{"label":"H","name":"ป้อมมุมตะวันตกเฉียงเหนือ","code":"gate_h","category":"ป้อมรักษาการ","summary":"จุดรักษาการมุมบนซ้ายของแผนที่ มีการตรวจคนและผลัดเวรตามหน้าที่","layer":"gates","x":3.1,"y":6.7},{"label":"I","name":"ประตูตะวันตกและสะพาน","code":"gate_i","category":"ประตูและจุดตรวจ","summary":"จุดรักษาการซ้ายกลางของแผนที่ มีการตรวจคนและผลัดเวรตามหน้าที่","layer":"gates","x":3.4,"y":55.8},{"label":"J","name":"ป้อมมุมตะวันตกเฉียงใต้","code":"gate_j","category":"ป้อมรักษาการ","summary":"จุดรักษาการมุมล่างซ้ายของแผนที่ มีการตรวจคนและผลัดเวรตามหน้าที่","layer":"gates","x":3.4,"y":91.9},{"label":"K","name":"ประตูซีหัว","code":"gate_k","category":"ประตูและจุดตรวจ","summary":"จุดรักษาการกำแพงกลางฝั่งซ้ายของแผนที่ มีการตรวจคนและผลัดเวรตามหน้าที่","layer":"gates","x":36.4,"y":55.6},{"label":"L","name":"ประตูเฉียนชิง","code":"gate_l","category":"ประตูและจุดตรวจ","summary":"จุดรักษาการกำแพงกลางตรงกลางของแผนที่ มีการตรวจคนและผลัดเวรตามหน้าที่","layer":"gates","x":50,"y":55.8},{"label":"M","name":"ประตูตงหัว","code":"gate_m","category":"ประตูและจุดตรวจ","summary":"จุดรักษาการกำแพงกลางฝั่งขวาของแผนที่ มีการตรวจคนและผลัดเวรตามหน้าที่","layer":"gates","x":61.9,"y":55.6}]$map$::jsonb) loop
    if exists(select 1 from public.exploration_locations where code = point->>'code') then
      update public.exploration_locations set map_label = point->>'label'
        where code = point->>'code' and map_label is null;
    else
      select n into free_zone from generate_series(1, 99) n
        where not exists(select 1 from public.exploration_locations where zone_number = n)
        order by n limit 1;
      if free_zone is null then raise exception 'No free exploration zone number'; end if;
      insert into public.exploration_locations(code, zone_number, name, short_name, category,
        summary, map_label, active, sort_order)
      values(point->>'code', free_zone, point->>'name', point->>'name', point->>'category',
        point->>'summary', point->>'label', false, free_zone);
    end if;
  end loop;
end;
$seed$;

commit;

-- Remove round and calendar quotas. Keep the existing pending-mission workflow.
begin;
drop index if exists public.self_exploration_one_per_round;
revoke update on public.exploration_settings from authenticated;
drop policy if exists "Staff update exploration round" on public.exploration_settings;
create or replace function public.get_player_exploration_map(p_character_id integer)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(
    (to_jsonb(l) - 'self_character_ids') || jsonb_build_object('can_explore_self',
      p_character_id = any(l.self_character_ids)
      and not exists (select 1 from public.follower_explorations m
        where m.character_id = p_character_id and m.follower_id is null
          and m.status = 'exploring'))
    order by l.sort_order), '[]'::jsonb)
  from public.exploration_locations l
  where l.active;
$$;

create or replace function public.start_map_exploration(
  p_character_id integer, p_location_id bigint, p_request_id uuid,
  p_follower_id bigint default null
)
returns public.follower_explorations
language plpgsql security definer set search_path = public as $$
declare
  place public.exploration_locations;
  person public.follower_master;
  mission public.follower_explorations;
begin
  if p_request_id is null then raise exception 'Request id required'; end if;
  -- Serializes starts for this character, including retries from multiple tabs.
  perform 1 from public.characters where id = p_character_id for update;
  if not found then raise exception 'Character not available'; end if;
  select * into mission from public.follower_explorations where request_id = p_request_id;
  if found then
    if mission.character_id <> p_character_id or mission.location_id <> p_location_id
      or mission.follower_id is distinct from p_follower_id then
      raise exception 'Request does not match original exploration';
    end if;
    mission.result_details := null;
    return mission;
  end if;

  select * into place from public.exploration_locations where id = p_location_id and active for share;
  if not found then raise exception 'Exploration location not available'; end if;

  if p_follower_id is not null then
    select * into person from public.follower_master where id = p_follower_id for update;
    if not found or not person.active or person.owner_character_id is distinct from p_character_id then
      raise exception 'Follower not available';
    end if;
    -- The established RPC enforces access, idle status and talents.
    mission := public.start_follower_exploration(p_character_id, p_follower_id, p_location_id, 'สำรวจและจัดหาของใช้');
    update public.follower_explorations set request_id = p_request_id where id = mission.id returning * into mission;
    mission.result_details := null;
    return mission;
  end if;

  if not (p_character_id = any(place.self_character_ids)) then raise exception 'Location access required'; end if;
  if exists (select 1 from public.follower_explorations where character_id = p_character_id
      and follower_id is null and status = 'exploring') then raise exception 'An active exploration already exists'; end if;
  insert into public.follower_explorations(character_id, follower_id, location_id, destination,
    objective, suitability_percent, request_id)
  values (p_character_id, null, place.id, place.name, 'สำรวจและจัดหาของใช้', 0, p_request_id)
  returning * into mission;
  insert into public.character_history(character_id, action, value, type)
    values(p_character_id, 'ออกสำรวจด้วยตัวเอง', place.name, 'follower_mission');
  return mission;
end;
$$;


create or replace function public.start_follower_exploration(
  p_character_id integer,
  p_follower_id bigint,
  p_location_id bigint,
  p_objective text default null
)
returns public.follower_explorations
language plpgsql
security definer
set search_path = public
as $$
declare
  follower_row public.follower_master;
  location_row public.exploration_locations;
  mission_row public.follower_explorations;
  suitability integer;
begin
  select * into follower_row
  from public.follower_master
  where id = p_follower_id
  for update;

  if not found
    or follower_row.owner_character_id is distinct from p_character_id then
    raise exception 'Follower does not belong to this character';
  end if;

  if btrim(coalesce(follower_row.status, ''), E' \n\r\t') <> 'idle' then
    raise exception 'Follower is already on a mission';
  end if;

  select * into location_row
  from public.exploration_locations
  where id = p_location_id and active;

  if not found then
    raise exception 'Exploration location is not available';
  end if;

  if not (
    location_row.short_name = any(coalesce(follower_row.access_areas, '{}'))
    or location_row.name = any(coalesce(follower_row.access_areas, '{}'))
    or location_row.category = any(coalesce(follower_row.access_areas, '{}'))
    or location_row.code = any(coalesce(follower_row.access_areas, '{}'))
  ) then
    raise exception 'Follower cannot access this exploration location';
  end if;


  select coalesce(sum(talent.modifier_percent), 0)::integer
  into suitability
  from public.follower_talents talent
  where talent.follower_id = p_follower_id
    and talent.talent_key = any(location_row.tags);

  insert into public.follower_explorations (
    follower_id,
    character_id,
    location_id,
    destination,
    objective,
    suitability_percent
  )
  values (
    p_follower_id,
    p_character_id,
    location_row.id,
    location_row.name,
    nullif(trim(p_objective), ''),
    suitability
  )
  returning * into mission_row;

  update public.follower_master
  set status = 'exploring', updated_at = now()
  where id = p_follower_id;

  insert into public.character_history (
    character_id,
    action,
    value,
    type
  )
  values (
    p_character_id,
    'ส่งผู้ติดตามสำรวจ',
    follower_row.name || ' → ' || location_row.short_name,
    'follower_mission'
  );

  return mission_row;
end;
$$;

revoke all on function public.start_follower_exploration(
  integer, bigint, bigint, text
) from public;

grant execute on function public.start_follower_exploration(
  integer, bigint, bigint, text
) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
commit;

begin;

create table if not exists public.exploration_location_notes (
  location_id bigint primary key references public.exploration_locations(id) on delete cascade,
  note text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.exploration_location_notes enable row level security;
drop policy if exists "Staff can manage exploration location notes" on public.exploration_location_notes;
create policy "Staff can manage exploration location notes"
  on public.exploration_location_notes for all to authenticated
  using (public.is_active_staff()) with check (public.is_active_staff());

revoke all on public.exploration_location_notes from public, anon;
grant select, insert, update, delete on public.exploration_location_notes to authenticated;

notify pgrst, 'reload schema';
commit;

begin;

-- A chance is the share of successful draws, not a required dice number.
-- Talent modifiers are relative to the area's base chance: 50% + 40% Talent = 70%.
create or replace function public.set_follower_exploration_chance()
returns trigger language plpgsql set search_path = public as $$
declare
  base_chance integer := 60;
begin
  if new.location_id is not null then
    select location.base_success_percent into base_chance
    from public.exploration_locations location where location.id = new.location_id;
  end if;
  new.success_chance_percent := greatest(5, least(95,
    round(coalesce(base_chance, 60) * (1 + coalesce(new.suitability_percent, 0) / 100.0))::integer
  ));
  return new;
end;
$$;

-- Preserve every historical result; only recalculate unrolled work.
update public.follower_explorations
set suitability_percent = suitability_percent
where status = 'exploring' and resolution_outcome is null;

alter table public.follower_explorations
  add column if not exists roll_origin text check (roll_origin in ('player'));

create or replace function public.draw_player_exploration_result(
  p_character_id integer, p_mission_id bigint
)
returns public.follower_explorations
language plpgsql security definer set search_path = public as $$
declare
  mission public.follower_explorations;
begin
  perform 1 from public.characters where id = p_character_id for update;
  if not found then raise exception 'Character not available'; end if;
  select * into mission from public.follower_explorations
  where id = p_mission_id and character_id = p_character_id for update;
  if not found then raise exception 'Exploration not found'; end if;
  if mission.resolution_outcome is not null then
    mission.result_details := null;
    return mission;
  end if;
  if mission.status <> 'exploring' then raise exception 'Exploration is no longer active'; end if;
  update public.follower_explorations set
    resolution_outcome = case when random() < mission.success_chance_percent / 100.0
      then 'success' else 'failure' end,
    roll_origin = 'player',
    rolled_at = now()
  where id = p_mission_id returning * into mission;
  mission.result_details := null;
  return mission;
end;
$$;
revoke all on function public.draw_player_exploration_result(integer,bigint) from public;
grant execute on function public.draw_player_exploration_result(integer,bigint) to anon, authenticated;

create or replace function public.start_map_exploration(
  p_character_id integer, p_location_id bigint, p_request_id uuid,
  p_follower_id bigint default null
)
returns public.follower_explorations
language plpgsql security definer set search_path = public as $$
declare
  place public.exploration_locations;
  person public.follower_master;
  mission public.follower_explorations;
begin
  if p_request_id is null then raise exception 'Request id required'; end if;
  perform 1 from public.characters where id = p_character_id for update;
  if not found then raise exception 'Character not available'; end if;
  select * into mission from public.follower_explorations where request_id = p_request_id;
  if found then
    if mission.character_id <> p_character_id or mission.location_id <> p_location_id
      or mission.follower_id is distinct from p_follower_id then
      raise exception 'Request does not match original exploration';
    end if;
    mission.result_details := null;
    return mission;
  end if;
  select * into place from public.exploration_locations where id = p_location_id and active for share;
  if not found then raise exception 'Exploration location not available'; end if;
  if p_follower_id is not null then
    select * into person from public.follower_master where id = p_follower_id for update;
    if not found or not person.active or person.owner_character_id is distinct from p_character_id then
      raise exception 'Follower not available';
    end if;
    mission := public.start_follower_exploration(p_character_id, p_follower_id, p_location_id, 'สำรวจและจัดหาของใช้');
    update public.follower_explorations set request_id = p_request_id
    where id = mission.id returning * into mission;
  else
    if not (p_character_id = any(place.self_character_ids)) then raise exception 'Location access required'; end if;
    if exists (select 1 from public.follower_explorations where character_id = p_character_id
        and follower_id is null and status = 'exploring') then
      raise exception 'An active exploration already exists';
    end if;
    insert into public.follower_explorations(character_id, follower_id, location_id, destination,
      objective, suitability_percent, request_id)
    values (p_character_id, null, place.id, place.name, 'สำรวจและจัดหาของใช้', 0, p_request_id)
    returning * into mission;
    insert into public.character_history(character_id, action, value, type)
      values(p_character_id, 'ออกสำรวจด้วยตัวเอง', place.name, 'follower_mission');
  end if;
  return public.draw_player_exploration_result(p_character_id, mission.id);
end;
$$;
revoke all on function public.start_map_exploration(integer,bigint,uuid,bigint) from public;
grant execute on function public.start_map_exploration(integer,bigint,uuid,bigint) to anon, authenticated;

-- Old staff RPC cannot re-roll an outcome already drawn by the player.
create or replace function public.roll_follower_exploration(p_mission_id bigint)
returns public.follower_explorations
language plpgsql security definer set search_path = public as $$
begin
  raise exception 'Exploration results are drawn by the player';
end;
$$;
revoke all on function public.roll_follower_exploration(bigint) from public, anon, authenticated;

-- Player history includes the outcome, but never staff-only details.
drop function if exists public.get_player_follower_explorations(integer);
create function public.get_player_follower_explorations(p_character_id integer)
returns table (
  id bigint, follower_id bigint, destination text, objective text, status text,
  result_summary text, result_details text, reward_item_name text,
  reward_quantity integer, started_at timestamptz, completed_at timestamptz,
  resolution_outcome text
)
language sql stable security definer set search_path = public as $$
  select mission.id, mission.follower_id, mission.destination, mission.objective,
    mission.status, mission.result_summary, null::text, reward.name,
    mission.reward_quantity, mission.started_at, mission.completed_at,
    mission.resolution_outcome
  from public.follower_explorations mission
  left join public.items reward on reward.id = mission.reward_item_id
  where mission.character_id = p_character_id
  order by mission.started_at desc limit 30;
$$;
revoke all on function public.get_player_follower_explorations(integer) from public;
grant execute on function public.get_player_follower_explorations(integer) to anon, authenticated;

notify pgrst, 'reload schema';
commit;

begin;

alter table public.follower_explorations
  add column if not exists drop_roll integer check (drop_roll between 1 and 100);

-- The player triggers both draws. Failure has no item number.
create or replace function public.draw_player_exploration_result(
  p_character_id integer, p_mission_id bigint
)
returns public.follower_explorations
language plpgsql security definer set search_path = public as $$
declare
  mission public.follower_explorations;
  passed boolean;
begin
  perform 1 from public.characters where id = p_character_id for update;
  if not found then raise exception 'Character not available'; end if;
  select * into mission from public.follower_explorations
  where id = p_mission_id and character_id = p_character_id for update;
  if not found then raise exception 'Exploration not found'; end if;
  if mission.resolution_outcome is not null then
    mission.result_details := null;
    return mission;
  end if;
  if mission.status <> 'exploring' then raise exception 'Exploration is no longer active'; end if;
  passed := random() < mission.success_chance_percent / 100.0;
  update public.follower_explorations set
    resolution_outcome = case when passed then 'success' else 'failure' end,
    drop_roll = case when passed then floor(random() * 100 + 1)::integer else null end,
    roll_origin = 'player',
    rolled_at = now()
  where id = p_mission_id returning * into mission;
  mission.result_details := null;
  return mission;
end;
$$;
revoke all on function public.draw_player_exploration_result(integer,bigint) from public;
grant execute on function public.draw_player_exploration_result(integer,bigint) to anon, authenticated;

-- Work that succeeded before this update can receive its d100 once in player history.
create or replace function public.draw_player_exploration_drop(
  p_character_id integer, p_mission_id bigint
)
returns public.follower_explorations
language plpgsql security definer set search_path = public as $$
declare
  mission public.follower_explorations;
begin
  perform 1 from public.characters where id = p_character_id for update;
  if not found then raise exception 'Character not available'; end if;
  select * into mission from public.follower_explorations
  where id = p_mission_id and character_id = p_character_id for update;
  if not found then raise exception 'Exploration not found'; end if;
  if mission.drop_roll is not null then
    mission.result_details := null;
    return mission;
  end if;
  if mission.status <> 'exploring' or mission.resolution_outcome not in ('success', 'critical_success') then
    raise exception 'Successful active exploration required';
  end if;
  update public.follower_explorations
  set drop_roll = floor(random() * 100 + 1)::integer
  where id = p_mission_id returning * into mission;
  mission.result_details := null;
  return mission;
end;
$$;
revoke all on function public.draw_player_exploration_drop(integer,bigint) from public;
grant execute on function public.draw_player_exploration_drop(integer,bigint) to anon, authenticated;

-- For player-drawn work, staff must receive the saved d100 before resolving success.
create or replace function public.require_player_exploration_drop()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'completed' and old.status = 'exploring'
    and new.roll_origin = 'player'
    and new.resolution_outcome in ('success', 'critical_success')
    and new.drop_roll is null then
    raise exception 'Player item number is required before resolving exploration';
  end if;
  return new;
end;
$$;
drop trigger if exists require_player_exploration_drop on public.follower_explorations;
create trigger require_player_exploration_drop before update of status
  on public.follower_explorations for each row
  execute function public.require_player_exploration_drop();

drop function if exists public.get_player_follower_explorations(integer);
create function public.get_player_follower_explorations(p_character_id integer)
returns table (
  id bigint, follower_id bigint, destination text, objective text, status text,
  result_summary text, result_details text, reward_item_name text,
  reward_quantity integer, started_at timestamptz, completed_at timestamptz,
  resolution_outcome text, drop_roll integer
)
language sql stable security definer set search_path = public as $$
  select mission.id, mission.follower_id, mission.destination, mission.objective,
    mission.status, mission.result_summary, null::text, reward.name,
    mission.reward_quantity, mission.started_at, mission.completed_at,
    mission.resolution_outcome, mission.drop_roll
  from public.follower_explorations mission
  left join public.items reward on reward.id = mission.reward_item_id
  where mission.character_id = p_character_id
  order by mission.started_at desc limit 30;
$$;
revoke all on function public.get_player_follower_explorations(integer) from public;
grant execute on function public.get_player_follower_explorations(integer) to anon, authenticated;

notify pgrst, 'reload schema';
commit;

begin;

-- Older successful jobs were drawn before the d100 became part of the first click.
-- Give each active job one permanent number so staff can finish it without
-- asking the player to return and draw again.
update public.follower_explorations
set drop_roll = floor(random() * 100 + 1)::integer
where status = 'exploring'
  and resolution_outcome in ('success', 'critical_success')
  and drop_roll is null;

commit;
notify pgrst, 'reload schema';

-- Keep 27 and 29 unchanged while moving Jingtian to 29.1 and assigning 25 to the pantry.

-- Run in Supabase SQL Editor after the map setup script.
-- Existing Jingtian explorations stay attached to the same location ID.
begin;

do $map$
declare
  free_zone integer;
begin
  update public.exploration_locations
  set map_label = '29.1'
  where code = 'jingtian_palace' and map_label is distinct from '29.1';

  if exists (
    select 1 from public.exploration_locations
    where map_label = '25' and code <> 'outer_kitchen_supplies'
  ) then
    raise exception 'Map label 25 is already assigned to another location';
  end if;

  if exists (select 1 from public.exploration_locations where code = 'outer_kitchen_supplies') then
    update public.exploration_locations
    set map_label = '25',
        name = 'ห้องเครื่องวังและเสบียงวังหน้า',
        short_name = 'ห้องเครื่องวังและเสบียงวังหน้า',
        category = 'กองงานวังหน้า',
        summary = 'ห้องจัดสำรับและคลังเสบียงสำหรับงานวังหน้า มีการตรวจรับวัตถุดิบและเบิกของตามบัญชี'
    where code = 'outer_kitchen_supplies';
  else
    select n into free_zone from generate_series(1, 99) n
    where not exists (select 1 from public.exploration_locations where zone_number = n)
    order by n limit 1;
    if free_zone is null then raise exception 'No free exploration zone number'; end if;

    insert into public.exploration_locations
      (code, zone_number, name, short_name, category, summary, map_label, active, sort_order)
    values
      ('outer_kitchen_supplies', free_zone, 'ห้องเครื่องวังและเสบียงวังหน้า',
       'ห้องเครื่องวังและเสบียงวังหน้า', 'กองงานวังหน้า',
       'ห้องจัดสำรับและคลังเสบียงสำหรับงานวังหน้า มีการตรวจรับวัตถุดิบและเบิกของตามบัญชี',
       '25', false, 25);
  end if;
end;
$map$;

commit;
notify pgrst, 'reload schema';


-- Rename point 18 without changing its location ID.

-- Run in Supabase SQL Editor to rename point 18 without replacing its location ID.
begin;

update public.exploration_locations
set name = 'ตำหนักจิ่งเฉิน',
    short_name = 'ตำหนักจิ่งเฉิน',
    category = case when category = 'กองงานวังหน้า' then 'ตำหนักวังหน้า' else category end,
    summary = case
      when summary = 'ครัวใหญ่เตรียมอาหารรับราชการและพระราชพิธี มีลานรับของ'
      then 'ตำหนักจิ่งเฉินในเขตวังหน้า มีลานและเรือนเชื่อมกับทางเดินหลัก'
      else summary
    end
where code = 'outer_kitchen';

commit;
notify pgrst, 'reload schema';

