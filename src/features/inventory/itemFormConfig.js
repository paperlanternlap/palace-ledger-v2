export const ITEM_CATEGORIES = [
  { value: "general", label: "ของใช้ทั่วไป" },
  { value: "favor", label: "เพิ่มโปรดปราน" },
  { value: "medicine", label: "ยาและการรักษา" },
  { value: "secret", label: "แผนลับ / ใส่ร้าย" },
  { value: "access", label: "เปิดพื้นที่หรืออีเวนต์" },
  { value: "defense", label: "ป้องกัน" },
  { value: "story", label: "ไอเท็มเนื้อเรื่อง" },
];

export const ACQUISITION_TYPES = [
  { value: "palace_stock", label: "เบิกจากคลังในวัง" },
  { value: "external_legal", label: "สั่งจัดหาจากนอกวัง" },
  { value: "restricted", label: "ติดต่อซื้อจาก NPC" },
  { value: "story_only", label: "ได้รับจากเนื้อเรื่องเท่านั้น" },
];

export const DEFAULT_ACQUISITION_SETTINGS = {
  acquisitionType: "palace_stock",
  catalogVisibility: "staff_only",
  acquisitionRequiresRoll: false,
  acquisitionSuccessPercent: 70,
  minimumFavor: 0,
  commandFavorThreshold: 20,
  fulfillmentDaysMin: 0,
  fulfillmentDaysMax: 1,
  autoFulfill: true,
  acquisitionChannelId: "",
  acquisitionRiskLevel: 1,
  failureConsequence: "",
  criticalFailureConsequence: "",
};

export function normalizeItemTasks(tasks) {
  if (!Array.isArray(tasks)) return [];
  return tasks
    .map((task) =>
      typeof task === "string"
        ? { label: task, type: "staff_action" }
        : { label: task?.label || "", type: task?.type || "staff_action" },
    )
    .filter((task) => task.label);
}
