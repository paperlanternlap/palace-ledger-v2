import { supabase } from "../../supabase";

export async function getRpSubmissions() {
  return supabase
    .from("rp_submissions")
    .select(
      `
        *,
        characters (
          id,
          character_name,
          player_name,
          avatar_url
        )
      `,
    )
    .order("submitted_at", { ascending: false })
    .limit(100);
}

export function getCharactersForSubmission() {
  return supabase
    .from("characters")
    .select("id, character_name, player_name, avatar_url")
    .order("character_name", { ascending: true });
}

export async function createRpSubmission({
  characterId,
  roleUrl,
  submissionType,
  participantNames,
  playerNote,
}) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) return { data: null, error: userError };

  return supabase
    .from("rp_submissions")
    .insert({
      character_id: characterId,
      requested_by: userData.user.id,
      role_url: roleUrl,
      submission_type: submissionType,
      participant_names: participantNames || null,
      player_note: playerNote || null,
      status: "pending",
    })
    .select("id")
    .single();
}

export async function reviewRpSubmission({
  submissionId,
  status,
  rp,
  favor,
  note,
}) {
  return supabase.rpc("review_rp_submission", {
    p_submission_id: submissionId,
    p_status: status,
    p_rp: rp,
    p_favor: favor,
    p_note: note,
  });
}
