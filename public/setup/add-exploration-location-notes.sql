begin;

create table if not exists public.exploration_location_notes (
  location_id bigint primary key references public.exploration_locations(id) on delete cascade,
  note text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.exploration_location_notes enable row level security;
drop policy if exists "Staff can manage exploration location notes" on public.exploration_location_notes;
create policy "Staff can manage exploration location notes"
  on public.exploration_location_notes for all to authenticated
  using (public.is_active_staff()) with check (public.is_active_staff());

revoke all on public.exploration_location_notes from public, anon;
grant select, insert, update, delete on public.exploration_location_notes to authenticated;

notify pgrst, 'reload schema';
commit;
