-- DESTRUCTIVE ONE-TIME RESET
-- Keeps staff_members, characters, and Supabase Auth accounts.
-- Preserves every character's identity/profile fields and current position.
-- Clears gameplay activity and all editable master content, then resets RP
-- and Favor to zero.

begin;

-- Dependent gameplay records.
delete from public.item_request_tasks;
delete from public.item_use_requests;
delete from public.follower_explorations;
delete from public.item_acquisition_requests;
delete from public.character_catalog_unlocks;
delete from public.character_acquisition_channel_unlocks;
delete from public.inventory_transactions;
delete from public.character_inventory;
delete from public.character_history;
delete from public.rp_submissions;

-- Editable master content that will be recreated by staff.
delete from public.follower_talents;
delete from public.follower_master;
delete from public.items;
delete from public.character_position_acquisition_privileges;
delete from public.acquisition_channels;
delete from public.exploration_locations;
delete from public.rp_reward_guidelines;
delete from public.rank_requirements;

-- Some early installations may still contain the retired item_master table.
do $$
begin
  if to_regclass('public.item_master') is not null then
    execute 'delete from public.item_master';
  end if;
end;
$$;

-- Keep character records and positions exactly as they are; reset only the
-- two spendable/progression balances requested for launch.
update public.characters
set rp = 0,
    favor = 0;

-- Restart numeric IDs for the cleared content where a serial/identity
-- sequence exists. This does not touch character or staff IDs.
do $$
declare
  table_row record;
  sequence_name text;
begin
  for table_row in
    select column_info.table_name
    from information_schema.columns column_info
    where column_info.table_schema = 'public'
      and column_info.column_name = 'id'
      and column_info.table_name = any (array[
        'item_request_tasks',
        'item_use_requests',
        'follower_explorations',
        'item_acquisition_requests',
        'character_catalog_unlocks',
        'character_acquisition_channel_unlocks',
        'inventory_transactions',
        'character_inventory',
        'character_history',
        'rp_submissions',
        'follower_talents',
        'follower_master',
        'items',
        'character_position_acquisition_privileges',
        'acquisition_channels',
        'exploration_locations',
        'rp_reward_guidelines',
        'rank_requirements'
      ])
  loop
    sequence_name := pg_get_serial_sequence(
      format('public.%I', table_row.table_name),
      'id'
    );
    if sequence_name is not null then
      execute format('alter sequence %s restart with 1', sequence_name);
    end if;
  end loop;
end;
$$;

commit;
