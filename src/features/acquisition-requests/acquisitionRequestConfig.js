export const ACTIVE_ACQUISITION_STATUSES = [
  "submitted",
  "approved",
  "awaiting_roll",
  "risk_review",
  "procuring",
  "ready",
];

export const ACQUISITION_FILTERS = [
  { id: "active", label: "กำลังดำเนินการ" },
  { id: "submitted", label: "รอตรวจ" },
  { id: "awaiting_roll", label: "รอทอย" },
  { id: "risk_review", label: "ตรวจผลความเสี่ยง" },
  { id: "ready", label: "พร้อมส่งมอบ" },
  { id: "completed", label: "เสร็จสิ้น" },
  { id: "all", label: "ทั้งหมด" },
];

export const ACQUISITION_STATUS_LABELS = {
  submitted: "รอตรวจ",
  approved: "อนุมัติแล้ว",
  awaiting_roll: "รอทอยจัดหา",
  risk_review: "รอสรุปผลความเสี่ยง",
  procuring: "กำลังจัดหา",
  ready: "พร้อมส่งมอบ",
  completed: "ส่งมอบแล้ว",
  rejected: "ไม่อนุมัติ",
  cancelled: "ยกเลิก",
};

export const ACQUISITION_ROUTE_LABELS = {
  requisition: "เบิกจากคลัง",
  procurement: "คำขอจัดซื้อ",
  command: "คำสั่งให้จัดซื้อ",
  restricted_contact: "ซื้อจาก NPC",
};

export const ACQUISITION_OUTCOME_LABELS = {
  critical_success: "สำเร็จอย่างยอดเยี่ยม",
  success: "สำเร็จ",
  failure: "ล้มเหลว",
  critical_failure: "ล้มเหลวร้ายแรง",
};

export function getAcquisitionRiskTarget(riskLevel) {
  if (riskLevel === 3) return 50;
  if (riskLevel === 4) return 65;
  if (riskLevel >= 5) return 80;
  return null;
}
