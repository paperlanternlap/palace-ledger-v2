-- Keep the existing location ID, access settings, and exploration history.
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
