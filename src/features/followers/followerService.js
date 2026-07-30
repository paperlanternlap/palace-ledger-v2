import { supabase } from "../../supabase";

export async function getFollowers() {
  let [followers, characters] = await Promise.all([
    supabase
      .from("follower_master")
      .select("*, talents:follower_talents(*)")
      .order("name", { ascending: true }),
    supabase
      .from("characters")
      .select("id, character_name, player_name, avatar_url"),
  ]);

  if (
    followers.error &&
    (followers.error.message?.includes("follower_talents") ||
      followers.error.code === "PGRST200")
  ) {
    followers = await supabase
      .from("follower_master")
      .select("*")
      .order("name", { ascending: true });
  }

  if (followers.error) return followers;
  if (characters.error) return characters;

  const characterMap = new Map(
    (characters.data || []).map((character) => [
      String(character.id),
      character,
    ]),
  );

  return {
    data: (followers.data || []).map((follower) => {
      const normalizedStatus = (follower.status || "idle").trim();
      const owner = follower.owner_character_id
        ? characterMap.get(String(follower.owner_character_id)) || null
        : null;
      const viewStatus = !follower.active
        ? "unavailable"
        : normalizedStatus !== "idle"
          ? "on_mission"
          : owner
            ? "assigned"
            : "available";
      return {
        ...follower,
        status: normalizedStatus,
        owner,
        view_status: viewStatus,
      };
    }),
    error: null,
  };
}

export function createFollower(values) {
  return supabase
    .from("follower_master")
    .insert({
      name: values.name,
      description: values.description || null,
      cost: values.cost,
      active: true,
      owner_character_id: null,
      status: "idle",
      avatar_url: values.avatarUrl || null,
      follower_type: values.followerType,
      access_areas: values.accessAreas,
      weekly_mission_limit: values.weeklyMissionLimit,
    })
    .select("id")
    .single();
}

export async function createFollowerWithTalents(values) {
  const followerResult = await createFollower(values);
  if (followerResult.error || !values.talents?.length) return followerResult;

  const talentResult = await supabase.from("follower_talents").insert(
    values.talents.map((talent) => ({
      follower_id: followerResult.data.id,
      talent_key: talent.key,
      label: talent.label,
      modifier_percent: talent.modifierPercent,
    })),
  );

  if (talentResult.error) {
    console.error("Created follower but could not save talents", talentResult.error);
  }
  return followerResult;
}

export function getExplorationLocations() {
  return supabase
    .from("exploration_locations")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });
}

export function getCharactersForFollowerAssignment() {
  return supabase
    .from("characters")
    .select("id, character_name, player_name")
    .order("character_name", { ascending: true });
}

export function assignFollower(followerId, characterId) {
  return supabase.rpc("assign_follower_to_character", {
    p_follower_id: followerId,
    p_character_id: characterId,
  });
}

export function releaseFollower(followerId) {
  return supabase.rpc("release_follower", {
    p_follower_id: followerId,
  });
}

export async function getFollowerExplorations() {
  let result = await supabase
    .from("follower_explorations")
    .select(`
      *,
      follower:follower_master (name),
      character:characters (character_name, player_name),
      location:exploration_locations (code, short_name, name, category, tags),
      reward:items (name)
    `)
    .order("status", { ascending: false })
    .order("started_at", { ascending: false });

  if (
    result.error &&
    (result.error.message?.includes("exploration_locations") ||
      result.error.code === "PGRST200")
  ) {
    result = await supabase
      .from("follower_explorations")
      .select(`
        *,
        follower:follower_master (name),
        character:characters (character_name, player_name),
        reward:items (name)
      `)
      .order("status", { ascending: false })
      .order("started_at", { ascending: false });
  }
  return result;
}

export function getFollowerRewardItems() {
  return supabase
    .from("items")
    .select("id, name, is_limited, stock_quantity")
    .eq("active", true)
    .order("name", { ascending: true });
}

export function resolveFollowerExploration({
  missionId,
  resultSummary,
  resultDetails,
  rewardItemId,
  rewardQuantity,
}) {
  return supabase.rpc("resolve_follower_exploration", {
    p_mission_id: missionId,
    p_result_summary: resultSummary,
    p_result_details: resultDetails || null,
    p_reward_item_id: rewardItemId || null,
    p_reward_quantity: rewardItemId ? rewardQuantity : 0,
  });
}

export function cancelFollowerExploration(missionId, reason) {
  return supabase.rpc("cancel_follower_exploration", {
    p_mission_id: missionId,
    p_reason: reason || null,
  });
}
