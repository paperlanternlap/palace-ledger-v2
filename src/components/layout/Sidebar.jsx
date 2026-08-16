import {
  LogOut,
} from "lucide-react";
import { STAFF_NAV_ITEMS } from "../../config/staffNavigation";

export function Sidebar({
  activePage,
  onNavigate,
  onSignOut,
  loggingOut,
}) {
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
        {STAFF_NAV_ITEMS.map(({ id, label, icon: Icon, disabled, badge }) => (
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
        <button type="button" onClick={onSignOut} disabled={loggingOut}>
          <LogOut size={16} />
          <span>{loggingOut ? "กำลังออก..." : "ออกจากระบบ"}</span>
        </button>
      </div>
    </aside>
  );
}
