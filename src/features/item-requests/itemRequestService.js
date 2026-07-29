import { supabase } from "../../supabase";

export function getItemUseRequests() {
  return supabase
    .from("item_use_requests")
    .select(`
      *,
      requester:characters!item_use_requests_requester_character_id_fkey (
        id,
        character_name,
        player_name,
        avatar_url
      ),
      target:characters!item_use_requests_target_character_id_fkey (
        id,
        character_name,
        player_name,
        avatar_url
      ),
      item:items (
        id,
        name,
        requires_roll
      ),
      tasks:item_request_tasks (
        id,
        label,
        task_type,
        status,
        sort_order,
        completed_at
      )
    `)
    .order("submitted_at", { ascending: false })
    .limit(100);
}

export async function getItemRequestFormOptions() {
  const [characters, items, inventory] = await Promise.all([
    supabase
      .from("characters")
      .select("id, character_name, player_name")
      .order("character_name"),
    supabase
      .from("items")
      .select("id, name, requires_target, default_channel, active")
      .eq("active", true)
      .order("name"),
    supabase
      .from("character_inventory")
      .select("character_id, item_name, quantity")
      .gt("quantity", 0),
  ]);

  return { characters, items, inventory };
}

export function createStaffItemUseRequest(values) {
  return supabase.rpc("create_staff_item_use_request", {
    p_requester_character_id: values.requesterCharacterId,
    p_item_id: values.itemId,
    p_quantity: values.quantity,
    p_request_type: values.requestType,
    p_target_character_id: values.targetCharacterId || null,
    p_actor_name: values.actorName || null,
    p_use_channel: values.useChannel || null,
    p_desired_effect: values.desiredEffect,
    p_details: values.details || null,
    p_role_url: values.roleUrl || null,
    p_secrecy_level: values.secrecyLevel,
  });
}

export function setItemRequestTaskStatus(taskId, status) {
  return supabase.rpc("set_item_request_task_status", {
    p_task_id: taskId,
    p_status: status,
  });
}

export function reviewItemUseRequest(requestId, status, staffNote) {
  return supabase.rpc("review_item_use_request", {
    p_request_id: requestId,
    p_status: status,
    p_staff_note: staffNote || null,
  });
}
