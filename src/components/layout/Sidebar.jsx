import {
  Activity,
  FileText,
  Gift,
  Home,
  ScrollText,
  Users,
} from "lucide-react";

const navItems = [
  { label: "ภาพรวม", icon: Home, disabled: true },
  { label: "ตัวละคร", icon: Users, active: true },
  { label: "คิวตรวจโรล", icon: ScrollText, disabled: true, badge: "เร็ว ๆ นี้" },
  { label: "คลังไอเท็ม", icon: Gift, disabled: true },
  { label: "ประวัติ", icon: FileText, disabled: true },
];

export function Sidebar() {
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
        {navItems.map(({ label, icon: Icon, active, disabled, badge }) => (
          <button
            key={label}
            type="button"
            className={`nav-item ${active ? "active" : ""}`}
            disabled={disabled}
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
