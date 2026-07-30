create or replace function public.submit_player_rp(
  p_character_id integer,
  p_role_url text,
  p_submission_type text default 'โรลเพลย์',
  p_participant_names text default null,
  p_player_note text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  submission_id bigint;
  clean_url text := btrim(coalesce(p_role_url, ''));
begin
  if not exists (
    select 1 from public.characters where id = p_character_id
  ) then
    raise exception 'Character not found';
  end if;

  if clean_url = '' or clean_url !~* '^https?://' then
    raise exception 'Role URL must start with http:// or https://';
  end if;

  insert into public.rp_submissions (
    character_id,
    requested_by,
    role_url,
    submission_type,
    participant_names,
    player_note,
    status
  )
  values (
    p_character_id,
    null,
    clean_url,
    coalesce(nullif(btrim(p_submission_type), ''), 'โรลเพลย์'),
    nullif(btrim(p_participant_names), ''),
    nullif(btrim(p_player_note), ''),
    'pending'
  )
  returning id into submission_id;

  return submission_id;
end;
$$;

create or replace function public.get_player_rp_submissions(
  p_character_id integer
)
returns table (
  id bigint,
  role_url text,
  submission_type text,
  participant_names text,
  player_note text,
  status text,
  awarded_rp integer,
  awarded_favor integer,
  staff_note text,
  submitted_at timestamptz,
  reviewed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    submission.id,
    submission.role_url,
    submission.submission_type,
    submission.participant_names,
    submission.player_note,
    submission.status,
    submission.awarded_rp,
    submission.awarded_favor,
    submission.staff_note,
    submission.submitted_at,
    submission.reviewed_at
  from public.rp_submissions submission
  where submission.character_id = p_character_id
  order by submission.submitted_at desc
  limit 20;
$$;

revoke all on function public.submit_player_rp(integer, text, text, text, text) from public;
revoke all on function public.get_player_rp_submissions(integer) from public;

grant execute on function public.submit_player_rp(integer, text, text, text, text)
  to anon, authenticated;
grant execute on function public.get_player_rp_submissions(integer)
  to anon, authenticated;
