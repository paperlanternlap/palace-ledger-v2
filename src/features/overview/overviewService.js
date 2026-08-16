import { supabase } from "../../supabase";

const ACTIVE_ITEM_REQUEST_STATUSES = [
  "submitted",
  "revision",
  "approved",
  "action_pending",
  "awaiting_player",
];
const ACTIVE_ACQUISITION_STATUSES = [
  "submitted",
  "approved",
  "awaiting_roll",
  "risk_review",
  "procuring",
  "ready",
];

export async function getStaffWorkCounts() {
  const [submissions, itemRequests, acquisitions, missions] = await Promise.all([
    supabase
      .from("rp_submissions")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "revision"]),
    supabase
      .from("item_use_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ACTIVE_ITEM_REQUEST_STATUSES),
    supabase
      .from("item_acquisition_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ACTIVE_ACQUISITION_STATUSES),
    supabase
      .from("follower_explorations")
      .select("id", { count: "exact", head: true })
      .eq("status", "exploring"),
  ]);

  return {
    counts: {
      "rp-queue": submissions.count || 0,
      "item-requests": itemRequests.count || 0,
      "acquisition-requests": acquisitions.count || 0,
      "exploration-missions": missions.count || 0,
    },
    hasError: [submissions, itemRequests, acquisitions, missions].some(
      (result) => result.error,
    ),
  };
}
