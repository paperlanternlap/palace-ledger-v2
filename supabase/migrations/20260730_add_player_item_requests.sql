drop function if exists public.get_character_inventory_details(integer);

create function public.get_character_inventory_details(
  p_character_id integer
)
returns table (
  inventory_id bigint,
  item_id bigint,
  item_name text,
  quantity integer,
  description text,
  use_category text,
  default_channel text,
  requires_target boolean,
  requires_roll boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    inventory.id::bigint,
    catalog.id::bigint,
    inventory.item_name,
    inventory.quantity,
    catalog.description,
    coalesce(catalog.use_category, 'general'),
    catalog.default_channel,
    coalesce(catalog.requires_target, false),
    coalesce(catalog.requires_roll, false)
  from public.character_inventory inventory
  left join public.items catalog
    on catalog.name = inventory.item_name
  where inventory.character_id = p_character_id
    and inventory.quantity > 0
  order by inventory.item_name;
$$;

create or replace function public.create_player_item_use_request(
  p_requester_character_id integer,
  p_item_id bigint,
  p_request_type text,
  p_target_character_id integer,
  p_actor_name text,
  p_use_channel text,
  p_desired_effect text,
  p_details text,
  p_role_url text,
  p_secrecy_level text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  target_item public.items;
  inventory_row public.character_inventory;
  request_id bigint;
  task_label jsonb;
  task_order integer := 10;
begin
  if p_request_type not in (
    'self', 'target', 'secret_plan', 'shared_plot', 'unlock', 'defense'
  ) then
    raise exception 'Invalid request type';
  end if;

  if p_secrecy_level not in ('normal', 'staff_only') then
    raise exception 'Invalid secrecy level';
  end if;

  if nullif(trim(p_desired_effect), '') is null then
    raise exception 'Desired effect is required';
  end if;

  select * into target_item
  from public.items
  where id = p_item_id and active;

  if not found then
    raise exception 'Active item not found';
  end if;

  if (target_item.requires_target or p_request_type = 'target')
    and p_target_character_id is null then
    raise exception 'Target character is required';
  end if;

  if p_target_character_id is not null
    and not exists (
      select 1 from public.characters where id = p_target_character_id
    ) then
    raise exception 'Target character not found';
  end if;

  select * into inventory_row
  from public.character_inventory
  where character_id = p_requester_character_id
    and item_name = target_item.name
  for update;

  if not found or inventory_row.quantity < 1 then
    raise exception 'Character does not have this item';
  end if;

  update public.character_inventory
  set quantity = quantity - 1
  where id = inventory_row.id;

  delete from public.character_inventory
  where id = inventory_row.id
    and quantity = 0;

  insert into public.item_use_requests (
    requester_character_id,
    target_character_id,
    item_id,
    quantity,
    request_type,
    actor_name,
    use_channel,
    desired_effect,
    details,
    role_url,
    secrecy_level,
    status,
    item_reserved,
    requested_by
  )
  values (
    p_requester_character_id,
    p_target_character_id,
    p_item_id,
    1,
    p_request_type,
    nullif(trim(p_actor_name), ''),
    coalesce(nullif(trim(p_use_channel), ''), target_item.default_channel),
    trim(p_desired_effect),
    nullif(trim(p_details), ''),
    nullif(trim(p_role_url), ''),
    p_secrecy_level,
    'submitted',
    true,
    auth.uid()
  )
  returning id into request_id;

  insert into public.item_request_tasks (
    request_id,
    label,
    task_type,
    sort_order
  )
  values
    (request_id, 'ตรวจจำนวนและสิทธิ์ใช้ไอเท็ม', 'validation', 1),
    (request_id, 'ตรวจช่องทาง เป้าหมาย และผลกระทบ', 'validation', 2),
    (request_id, 'ดำเนินผล: ' || trim(p_desired_effect), 'staff_action', 50);

  if jsonb_typeof(target_item.action_template) = 'array' then
    for task_label in
      select * from jsonb_array_elements(target_item.action_template)
    loop
      if nullif(trim(coalesce(task_label->>'label', task_label #>> '{}')), '')
        is not null then
        insert into public.item_request_tasks (
          request_id,
          label,
          task_type,
          sort_order
        )
        values (
          request_id,
          coalesce(task_label->>'label', task_label #>> '{}'),
          case
            when task_label->>'type' in (
              'staff_action', 'player_action', 'validation'
            ) then task_label->>'type'
            else 'staff_action'
          end,
          task_order
        );
        task_order := task_order + 1;
      end if;
    end loop;
  end if;

  if p_request_type = 'secret_plan' then
    insert into public.item_request_tasks (
      request_id,
      label,
      task_type,
      sort_order
    )
    values
      (
        request_id,
        'ดำเนินแผนหรือปล่อยข่าวในช่องทางที่กำหนด',
        'staff_action',
        80
      ),
      (
        request_id,
        'บันทึกข่าวลือ ร่องรอย หรือผลสืบสวน',
        'staff_action',
        90
      );
  end if;

  if target_item.requires_roll then
    insert into public.item_request_tasks (
      request_id,
      label,
      task_type,
      sort_order
    )
    values (
      request_id,
      'แจ้งการทอยและรอผลจากผู้เกี่ยวข้อง',
      'player_action',
      95
    );
  end if;

  insert into public.item_request_tasks (
    request_id,
    label,
    task_type,
    sort_order
  )
  values (
    request_id,
    'แจ้งผลและปิดคำร้อง',
    'staff_action',
    100
  );

  insert into public.character_history (
    character_id,
    action,
    value,
    type
  )
  values (
    p_requester_character_id,
    'ส่งคำร้องใช้ไอเท็ม',
    target_item.name,
    'item_request'
  );

  return request_id;
end;
$$;

revoke all on function public.get_character_inventory_details(integer)
  from public;
grant execute on function public.get_character_inventory_details(integer)
  to anon, authenticated;

revoke all on function public.create_player_item_use_request(
  integer, bigint, text, integer, text, text, text, text, text, text
) from public;
grant execute on function public.create_player_item_use_request(
  integer, bigint, text, integer, text, text, text, text, text, text
) to anon, authenticated;

