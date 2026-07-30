update public.item_use_requests
set target_character_id = requester_character_id
where request_type = 'self'
  and target_character_id is distinct from requester_character_id;

alter table public.item_use_requests
  drop constraint if exists item_use_requests_self_target_check;

alter table public.item_use_requests
  add constraint item_use_requests_self_target_check
  check (
    request_type <> 'self'
    or target_character_id is not distinct from requester_character_id
  );
