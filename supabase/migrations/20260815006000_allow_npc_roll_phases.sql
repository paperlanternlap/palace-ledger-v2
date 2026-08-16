-- Run after 20260815005000_contested_npc_rolls.sql.
-- Allow the player-initiated NPC negotiation phases introduced by the new
-- risk-based roll workflow.

begin;

alter table public.item_acquisition_requests
  drop constraint if exists item_acquisition_requests_roll_phase_check,
  add constraint item_acquisition_requests_roll_phase_check check (
    roll_phase is null or roll_phase in (
      'contact_and_smuggling',
      'negotiation',
      'opposed_negotiation',
      'target_negotiation'
    )
  );

commit;
