import { supabase } from "../../supabase";

const CLOSED_REQUEST_STATUSES = new Set(["completed", "rejected", "cancelled"]);

export async function getStaffWorkCounts() {
  const [submissions, itemRequests, acquisitions, missions] = await Promise.all([
    supabase.from("rp_submissions").select("status").limit(500),
    supabase.from("item_use_requests").select("status").limit(500),
    supabase.from("item_acquisition_requests").select("status").limit(500),
    supabase
      .from("follower_explorations")
      .select("id", { count: "exact", head: true })
      .eq("status", "exploring"),
  ]);

  return {
    counts: {
      "rp-queue": (submissions.data || []).filter(
        (item) => item.status === "pending" || item.status === "revision",
      ).length,
      "item-requests": (itemRequests.data || []).filter(
        (item) => !CLOSED_REQUEST_STATUSES.has(item.status),
      ).length,
      "acquisition-requests": (acquisitions.data || []).filter(
        (item) => !CLOSED_REQUEST_STATUSES.has(item.status),
      ).length,
      "exploration-missions": missions.count || 0,
    },
    hasError: [submissions, itemRequests, acquisitions, missions].some(
      (result) => result.error,
    ),
  };
}
