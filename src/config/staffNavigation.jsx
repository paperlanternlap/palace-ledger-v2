import {
  ClipboardList,
  Compass,
  FileText,
  Gift,
  Home,
  ScrollText,
  ShoppingBasket,
  UserRoundCheck,
  Users,
} from "lucide-react";

export const STAFF_NAV_ITEMS = [
  { id: "dashboard", label: "ภาพรวม", title: "ภาพรวมงาน", icon: Home },
  { id: "characters", label: "ตัวละคร", title: "จัดการตัวละคร", icon: Users },
  { id: "rp-queue", label: "คิวตรวจผลงาน", title: "คิวตรวจผลงาน", icon: ScrollText },
  { id: "item-requests", label: "คำร้อง", title: "คำร้องและงานแม่งาน", icon: ClipboardList },
  { id: "acquisition-requests", label: "คำร้องจัดหา", title: "คำร้องจัดหาไอเท็ม", icon: ShoppingBasket },
  { id: "exploration-missions", label: "ภารกิจสำรวจ", title: "ภารกิจสำรวจ", icon: Compass },
  { id: "inventory", label: "คลังไอเท็ม", title: "คลังไอเท็ม", icon: Gift },
  { id: "followers", label: "ผู้ติดตาม", title: "จัดการผู้ติดตาม", icon: UserRoundCheck },
  { label: "ประวัติ", icon: FileText, disabled: true },
];

const PAGE_TITLES = Object.fromEntries(
  STAFF_NAV_ITEMS.filter((item) => item.id).map((item) => [item.id, item.title]),
);

export function getStaffPageTitle(pageId) {
  return PAGE_TITLES[pageId] || PAGE_TITLES.inventory;
}
