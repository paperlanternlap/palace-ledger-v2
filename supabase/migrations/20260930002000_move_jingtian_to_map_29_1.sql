-- Correct Jingtian to 29.1 whether its prior label is 25 or 27.1.
-- Preserve its location ID, exploration history, and access settings.
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
