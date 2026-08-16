import { supabase } from "../../supabase";

const CHARACTER_SUMMARY_FIELDS = `
  id, character_name, player_name, username, role, position, palace, avatar_url,
  rp, favor, promotion_locked, promotion_lock_reason
`;

export async function getCharacters() {
  return supabase
    .from("characters")
    .select(CHARACTER_SUMMARY_FIELDS)
    .order("character_name", { ascending: true });
}

export function createCharacter(values) {
  return supabase
    .from("characters")
    .insert({
      character_name: values.characterName.trim(),
      player_name: values.playerName.trim(),
      username: values.username.trim(),
      position: values.position.trim() || null,
      palace: values.palace.trim() || null,
      role: values.role.trim() || null,
      avatar_url: values.avatarUrl.trim() || null,
      rp: 0,
      favor: 0,
    })
    .select(CHARACTER_SUMMARY_FIELDS)
    .single();
}

export async function getCharacterDetails(characterId) {
  const [inventory, history, npcAcquaintances] = await Promise.all([
    supabase
      .from("character_inventory")
      .select("id, item_name, quantity")
      .eq("character_id", characterId)
      .order("item_name", { ascending: true }),
    supabase
      .from("character_history")
      .select("id, action, value, type, created_at")
      .eq("character_id", characterId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("character_acquisition_channel_unlocks")
      .select(`
        id,
        source,
        note,
        unlocked_at,
        acquisition_channel:acquisition_channels (
          id,
          npc_name,
          npc_role,
          access_reason,
          risk_level
        )
      `)
      .eq("character_id", characterId)
      .order("unlocked_at", { ascending: false }),
  ]);

  return { inventory, history, npcAcquaintances };
}

export function getNpcAcquisitionChannels() {
  return supabase
    .from("acquisition_channels")
    .select("id, npc_name, npc_role, access_reason, unlock_method, risk_level")
    .eq("active", true)
    .order("npc_name", { ascending: true });
}

export function addCharacterNpcAcquaintance({
  characterId,
  acquisitionChannelId,
  source,
  note,
}) {
  return supabase.rpc("unlock_character_acquisition_channel", {
    p_character_id: characterId,
    p_acquisition_channel_id: acquisitionChannelId,
    p_source: source || null,
    p_note: note || null,
  });
}

export async function updateScore({
  characterId,
  field,
  currentValue,
  nextValue,
}) {
  return supabase
    .from("characters")
    .update({ [field]: nextValue })
    .eq("id", characterId)
    .eq(field, currentValue);
}

export async function addHistory(entry) {
  return supabase.from("character_history").insert(entry);
}

export function getGrantableItems() {
  return supabase
    .from("items")
    .select("id, name, description, is_limited, stock_quantity, active")
    .order("name", { ascending: true });
}

export function grantItemToCharacter({
  itemId,
  characterId,
  quantity,
  note,
}) {
  return supabase.rpc("grant_catalog_item", {
    p_item_id: itemId,
    p_character_id: characterId,
    p_quantity: quantity,
    p_note: note || null,
  });
}

export function adjustCharacterResource({ characterId, resource, delta, note }) {
  return supabase.rpc("adjust_character_resource", {
    p_character_id: characterId,
    p_resource: resource,
    p_delta: delta,
    p_note: note,
  });
}

export function adjustCharacterItem({ characterId, itemId, delta, note }) {
  return supabase.rpc("adjust_character_item", {
    p_character_id: characterId,
    p_item_id: itemId,
    p_delta: delta,
    p_note: note,
  });
}

export function getPreviousPosition(position) {
  return supabase
    .from("rank_requirements")
    .select("current_position")
    .eq("next_position", position)
    .limit(1)
    .maybeSingle();
}

export function getNextPosition(position) {
  return supabase
    .from("rank_requirements")
    .select("next_position, favor_required, max_slots")
    .eq("current_position", position)
    .limit(1)
    .maybeSingle();
}

export function demoteCharacter({ characterId, note }) {
  return supabase.rpc("demote_character", {
    p_character_id: characterId,
    p_note: note,
  });
}

export function promoteCharacter({ characterId, note }) {
  return supabase.rpc("promote_character_staff", {
    p_character_id: characterId,
    p_note: note,
  });
}

export function specialAppointCharacter({
  characterId,
  role,
  position,
  action,
  note,
  restoreNormalPromotion,
}) {
  return supabase.rpc("special_appoint_character", {
    p_character_id: characterId,
    p_role: role,
    p_position: position,
    p_action: action,
    p_note: note,
    p_restore_normal_promotion: restoreNormalPromotion,
  });
}
