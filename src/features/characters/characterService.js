import { supabase } from "../../supabase";

export async function getCharacters() {
  return supabase
    .from("characters")
    .select("*")
    .order("character_name", { ascending: true });
}

export async function getCharacterDetails(characterId) {
  const [inventory, history] = await Promise.all([
    supabase
      .from("character_inventory")
      .select("*")
      .eq("character_id", characterId)
      .order("item_name", { ascending: true }),
    supabase
      .from("character_history")
      .select("*")
      .eq("character_id", characterId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return { inventory, history };
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
