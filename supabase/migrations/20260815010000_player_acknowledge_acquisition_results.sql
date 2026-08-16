-- Allows a player to dismiss a closed acquisition result without deleting it.

begin;

alter table public.item_acquisition_requests
  add column if not exists player_acknowledged_at timestamptz;

create index if not exists item_acquisition_requests_player_visible
  on public.item_acquisition_requests (character_id, submitted_at desc)
  where player_acknowledged_at is null;

create or replace function public.acknowledge_player_item_acquisition_request(
  p_character_id integer,
  p_request_id bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.item_acquisition_requests
  set player_acknowledged_at = coalesce(player_acknowledged_at, now()),
      updated_at = now()
  where id = p_request_id
    and character_id = p_character_id
    and status in ('rejected', 'cancelled');

  if not found then
    raise exception 'Closed acquisition request not found';
  end if;

  return true;
end;
$$;

-- Keep the existing player-facing return shape, but exclude results the
-- player has already acknowledged.
drop function if exists public.get_player_item_acquisition_requests(integer);
create function public.get_player_item_acquisition_requests(
  p_character_id integer
)
returns table (
  id bigint,
  item_name text,
  quantity integer,
  request_route text,
  status text,
  staff_note text,
  charged_amount integer,
  resolution_roll integer,
  npc_opposed_roll integer,
  acquisition_risk_level integer,
  resolution_outcome text,
  roll_phase text,
  consequence text,
  acquisition_channel_name text,
  auto_delivery boolean,
  available_at timestamptz,
  submitted_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    request.id,
    item.name,
    request.quantity,
    request.request_route,
    request.status,
    request.staff_note,
    request.charged_amount,
    request.resolution_roll,
    request.npc_opposed_roll,
    item.acquisition_risk_level,
    request.resolution_outcome,
    request.roll_phase,
    request.consequence,
    channel.npc_name,
    request.auto_delivery,
    request.available_at,
    request.submitted_at,
    request.updated_at
  from public.item_acquisition_requests request
  join public.items item on item.id = request.item_id
  left join public.acquisition_channels channel
    on channel.id = request.acquisition_channel_id
  where request.character_id = p_character_id
    and request.player_acknowledged_at is null
  order by request.submitted_at desc
  limit 20;
$$;

revoke all on function public.acknowledge_player_item_acquisition_request(integer, bigint) from public;
revoke all on function public.get_player_item_acquisition_requests(integer) from public;
grant execute on function public.acknowledge_player_item_acquisition_request(integer, bigint)
  to anon, authenticated;
grant execute on function public.get_player_item_acquisition_requests(integer)
  to anon, authenticated;

commit;
