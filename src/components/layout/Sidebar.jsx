import {
  Activity,
  ClipboardList,
  FileText,
  Gift,
  Home,
  ScrollText,
  UserRoundCheck,
  Users,
} from "lucide-react";

const navItems = [
  { id: "dashboard", label: "ภาพรวม", icon: Home, disabled: true },
  { id: "characters", label: "ตัวละคร", icon: Users },
  { id: "rp-queue", label: "คิวตรวจโรล", icon: ScrollText },
  { id: "item-requests", label: "คำร้อง", icon: ClipboardList },
  { id: "inventory", label: "คลังไอเท็ม", icon: Gift },
  { id: "followers", label: "ผู้ติดตาม", icon: UserRoundCheck },
  { label: "ประวัติ", icon: FileText, disabled: true },
];

export function Sidebar({ activePage, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">紅</div>
        <div>
          <h1>หลันโจว</h1>
          <p>PALACE LEDGER</p>
        </div>
      </div>

      <nav className="nav-list" aria-label="เมนูหลัก">
        {navItems.map(({ id, label, icon: Icon, disabled, badge }) => (
          <button
            key={label}
            type="button"
            className={`nav-item ${activePage === id ? "active" : ""}`}
            disabled={disabled}
            onClick={() => id && onNavigate(id)}
            title={disabled ? "เมนูนี้กำลังพัฒนา" : undefined}
          >
            <Icon size={18} strokeWidth={1.8} />
            <span>{label}</span>
            {badge && <small>{badge}</small>}
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        <Activity size={16} />
        <span>Staff workspace</span>
      </div>
    </aside>
  );
}
