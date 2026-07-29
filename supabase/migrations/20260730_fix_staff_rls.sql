create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff_members
    where user_id = auth.uid() and active
  );
$$;

revoke all on function public.is_active_staff() from public;
grant execute on function public.is_active_staff() to authenticated;

drop policy if exists "Staff can view staff membership"
  on public.staff_members;
drop policy if exists "Staff can view all RP submissions"
  on public.rp_submissions;

create policy "Staff can view staff membership"
  on public.staff_members for select
  to authenticated
  using (public.is_active_staff());

create policy "Staff can view all RP submissions"
  on public.rp_submissions for select
  to authenticated
  using (public.is_active_staff());
