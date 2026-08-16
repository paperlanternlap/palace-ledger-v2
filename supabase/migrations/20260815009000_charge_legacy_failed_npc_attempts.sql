-- Run after 20260815008000_enforce_risk_roll_rules.sql.
-- Older versions charged RP only when an NPC negotiation succeeded. Bring
-- still-active failed attempts in line with the agreed pay-per-attempt rule.

begin;

do $$
declare
  failed_request record;
  total_cost integer;
  current_rp integer;
begin
  for failed_request in
    select request.id,
           request.character_id,
           request.item_id,
           request.quantity,
           item.name as item_name,
           item.cost
    from public.item_acquisition_requests request
    join public.items item on item.id = request.item_id
    where request.request_route = 'restricted_contact'
      and request.status = 'risk_review'
      and request.resolution_outcome in ('failure', 'critical_failure')
      and coalesce(request.charged_amount, 0) = 0
      and request.charged_currency is null
    order by request.id
    for update of request
  loop
    total_cost := failed_request.cost * failed_request.quantity;

    select coalesce(rp, 0)
    into current_rp
    from public.characters
    where id = failed_request.character_id
    for update;

    -- The attempt originally checked affordability before rolling. If the
    -- balance has since changed, leave it untouched for staff review instead
    -- of creating a negative balance.
    if current_rp >= total_cost then
      update public.characters
      set rp = rp - total_cost
      where id = failed_request.character_id;

      update public.item_acquisition_requests
      set charged_currency = 'rp',
          charged_amount = total_cost,
          updated_at = now()
      where id = failed_request.id;

      insert into public.character_history (character_id, action, value, type)
      values (
        failed_request.character_id,
        'หัก RP สำหรับการเจรจาที่ไม่สำเร็จ',
        failed_request.item_name || ' ×' || failed_request.quantity
          || ' · ' || total_cost || ' RP',
        'item_acquisition'
      );
    end if;
  end loop;
end;
$$;

commit;
