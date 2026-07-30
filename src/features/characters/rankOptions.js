export const CHARACTER_ROLE_OPTIONS = [
  "พระสนม",
  "นางกำนัล",
  "ขันที",
  "ทหาร / องครักษ์",
  "ขุนนาง",
  "สามัญชน",
  "อื่น ๆ",
];

export const POSITION_OPTIONS_BY_ROLE = {
  พระสนม: [
    "ไฉหนวี่",
    "ยวี่หนวี่",
    "เป่าหลิน",
    "ไฉเหริน",
    "เหมย่เหริน",
    "เจี๋ยอวี้",
    "จิ่วผิน",
    "ซื่อฝูเหริน",
    "ฮองเฮา",
  ],
  นางกำนัล: [
    "นางกำนัลฝึกหัด",
    "นางกำนัลประจำฝ่ายงาน",
    "นางกำนัลประจำตำหนัก",
    "นางกำนัลประจำตำหนักอาวุโส",
    "นางกำนัลรับใช้ใกล้ชิด",
    "ซ่างกง",
  ],
  ขันที: [
    "ขันทีฝึกหัด",
    "ขันทีประจำฝ่ายงาน",
    "ขันทีประจำตำหนัก",
    "ขันทีประจำตำหนักอาวุโส",
    "ขันทีรับใช้ใกล้ชิด",
    "หัวหน้าขันที",
  ],
  "ทหาร / องครักษ์": [
    "ทหารยามใหม่",
    "ทหารยามประจำการ",
    "องครักษ์ประจำประตู",
    "องครักษ์ส่วนพระองค์",
    "หัวหน้าองครักษ์",
  ],
};

export function getPositionOptions(role, characters = []) {
  const configured =
    role === "all"
      ? Object.values(POSITION_OPTIONS_BY_ROLE).flat()
      : POSITION_OPTIONS_BY_ROLE[role] || [];
  const existing = characters
    .filter((character) => role === "all" || character.role === role)
    .map((character) => character.position)
    .filter(Boolean);

  return [...new Set([...configured, ...existing])];
}
