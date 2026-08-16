import { supabase } from "../../supabase";

export function getAcquisitionRequests() {
  return supabase
    .from("item_acquisition_requests")
    .select(`
      *,
      character:characters (id, character_name, player_name, avatar_url, rp, favor),
      item:items (id, name, description, acquisition_type, acquisition_requires_roll,
        fulfillment_days_min, fulfillment_days_max, cost, is_limited,
        acquisition_risk_level, failure_consequence, critical_failure_consequence),
      channel:acquisition_channels (id, npc_name, npc_role, risk_summary, risk_level)
    `)
    .eq("auto_delivery", false)
    .order("submitted_at", { ascending: false })
    .limit(200);
}

export function reviewAcquisitionRequest(requestId, status, staffNote) {
  return supabase.rpc("review_item_acquisition_request", {
    p_request_id: requestId,
    p_status: status,
    p_staff_note: staffNote || null,
  });
}

export function rollAcquisitionRequest(requestId) {
  return supabase.rpc("roll_item_acquisition", {
    p_request_id: requestId,
  });
}

export function rollNpcPurchaseHiddenResult(requestId) {
  return supabase.rpc("roll_npc_purchase_hidden_result", {
    p_request_id: requestId,
  });
}
