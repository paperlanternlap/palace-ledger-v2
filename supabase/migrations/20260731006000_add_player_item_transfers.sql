alter table public.items
  add column if not exists transferable boolean not null default true;

create extension if not exists pg_trgm;

alter table public.inventory_transactions
  drop constraint if exists inventory_transactions_transaction_type_check;

alter table public.inventory_transactions
  add constraint inventory_transactions_transaction_type_check
  check (
    transaction_type in (
      'initial', 'restock', 'adjustment', 'grant', 'revoke',
      'use', 'purchase', 'transfer_out', 'transfer_in'
    )
  );

create index if not exists characters_transfer_search
  on public.characters using gin (
    (
      coalesce(character_name, '') || ' ' ||
      coalesce(player_name, '') || ' ' ||
      coalesce(username, '')
    ) gin_trgm_ops
  );

create or replace function public.search_item_transfer_recipients(
  p_sender_character_id integer,
  p_query text,
  p_limit integer default 8,
  p_offset integer default 0
)
returns table (
  id integer,
  character_name text,
  player_name text,
  username text,
  "position" text,
  avatar_url text
)
language sql
security definer
set search_path = public
as $$
  select
    character.id,
    character.character_name,
    character.player_name,
    character.username,
    character.position,
    character.avatar_url
  from public.characters character
  where character.id <> p_sender_character_id
    and length(trim(coalesce(p_query, ''))) >= 2
    and (
      character.character_name ilike '%' || trim(p_query) || '%'
      or character.player_name ilike '%' || trim(p_query) || '%'
      or character.username ilike '%' || trim(p_query) || '%'
    )
  order by
    case
      when character.character_name ilike trim(p_query) || '%' then 0
      when character.username ilike trim(p_query) || '%' then 1
      else 2
    end,
    character.character_name
  limit least(greatest(coalesce(p_limit, 8), 1), 10)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.transfer_character_item(
  p_sender_character_id integer,
  p_recipient_character_id integer,
  p_item_id bigint,
  p_quantity integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_item public.items;
  sender_inventory public.character_inventory;
  sender_name text;
  recipient_name text;
begin
  if p_sender_character_id is null
    or p_recipient_character_id is null
    or p_sender_character_id = p_recipient_character_id then
    raise exception 'Invalid transfer recipient';
  end if;

  if coalesce(p_quantity, 0) < 1 then
    raise exception 'Transfer quantity must be positive';
  end if;

  select * into target_item
  from public.items
  where id = p_item_id and active = true;

  if not found then
    raise exception 'Item not found';
  end if;

  if not target_item.transferable then
    raise exception 'Item is not transferable';
  end if;

  select character_name into sender_name
  from public.characters
  where id = p_sender_character_id;

  select character_name into recipient_name
  from public.characters
  where id = p_recipient_character_id;

  if sender_name is null or recipient_name is null then
    raise exception 'Character not found';
  end if;

  select * into sender_inventory
  from public.character_inventory
  where character_id = p_sender_character_id
    and item_name = target_item.name
  for update;

  if not found or sender_inventory.quantity < p_quantity then
    raise exception 'Insufficient item quantity';
  end if;

  update public.character_inventory
  set quantity = quantity - p_quantity
  where id = sender_inventory.id;

  delete from public.character_inventory
  where id = sender_inventory.id and quantity = 0;

  insert into public.character_inventory (character_id, item_name, quantity)
  values (p_recipient_character_id, target_item.name, p_quantity)
  on conflict (character_id, item_name)
  do update set quantity = public.character_inventory.quantity + excluded.quantity;

  insert into public.inventory_transactions (
    item_id, character_id, quantity_change, transaction_type, note
  )
  values
    (
      p_item_id, p_sender_character_id, -p_quantity, 'transfer_out',
      'ส่งให้ ' || recipient_name
    ),
    (
      p_item_id, p_recipient_character_id, p_quantity, 'transfer_in',
      'ได้รับจาก ' || sender_name
    );

  insert into public.character_history (character_id, action, value, type)
  values
    (
      p_sender_character_id,
      'ส่งไอเท็มให้ ' || recipient_name,
      target_item.name || ' ×' || p_quantity,
      'item'
    ),
    (
      p_recipient_character_id,
      'ได้รับไอเท็มจาก ' || sender_name,
      target_item.name || ' ×' || p_quantity,
      'item'
    );
end;
$$;

revoke all on function public.search_item_transfer_recipients(integer, text, integer, integer)
  from public;
revoke all on function public.transfer_character_item(integer, integer, bigint, integer)
  from public;

grant execute on function public.search_item_transfer_recipients(integer, text, integer, integer)
  to anon, authenticated;
grant execute on function public.transfer_character_item(integer, integer, bigint, integer)
  to anon, authenticated;
