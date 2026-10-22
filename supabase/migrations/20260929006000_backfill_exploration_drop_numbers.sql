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
