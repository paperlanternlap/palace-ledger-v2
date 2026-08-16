import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Compass,
  RefreshCw,
  ScrollText,
  ShoppingBasket,
} from "lucide-react";
import { getStaffWorkCounts } from "./overviewService";

const workQueues = [
  {
    id: "rp-queue",
    label: "ผลงานรอตรวจ",
    icon: ScrollText,
  },
  {
    id: "item-requests",
    label: "คำร้องที่ต้องทำ",
    icon: ClipboardList,
  },
  {
    id: "acquisition-requests",
    label: "งานจัดหาไอเท็ม",
    icon: ShoppingBasket,
  },
  {
    id: "exploration-missions",
    label: "ภารกิจรอตอบ",
    icon: Compass,
  },
];

export function StaffOverview({ onNavigate }) {
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCounts = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await getStaffWorkCounts();
    if (result.hasError) {
      setError("โหลดจำนวนงานบางส่วนไม่สำเร็จ");
    }
    setCounts(result.counts);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadCounts, 0);
    return () => window.clearTimeout(timer);
  }, [loadCounts]);

  const totalWork = useMemo(
    () => Object.values(counts).reduce((sum, count) => sum + count, 0),
    [counts],
  );

  return (
    <section className="staff-overview">
      <div className="overview-welcome">
        <div>
          <span>STAFF WORKSPACE</span>
          <h2>เริ่มงานจากตรงนี้</h2>
          <p>
            {loading
              ? "กำลังตรวจสอบงานที่รออยู่..."
              : totalWork
                ? `มี ${totalWork} งานที่ต้องจัดการ`
                : "ไม่มีงานค้างในตอนนี้"}
          </p>
        </div>
        <button type="button" onClick={loadCounts} disabled={loading}>
          <RefreshCw size={15} className={loading ? "spinning" : ""} />
          อัปเดต
        </button>
      </div>

      {error && <p className="overview-error">{error}</p>}

      <div className="overview-queue-grid">
        {workQueues.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            className="overview-queue-card"
            key={id}
            onClick={() => onNavigate(id)}
          >
            <span className="overview-queue-icon">
              <Icon size={21} />
            </span>
            <span className="overview-queue-copy">
              <strong>{label}</strong>
            </span>
            <span className="overview-queue-action">
              <b>{loading ? "…" : counts[id] || 0}</b>
              <small>เปิดคิว</small>
            </span>
          </button>
        ))}
      </div>

      <div className="overview-shortcuts">
        <h3>งานจัดการระบบ</h3>
        <div>
          <button type="button" onClick={() => onNavigate("characters")}>
            จัดการตัวละคร
          </button>
          <button type="button" onClick={() => onNavigate("inventory")}>
            คลังไอเท็ม
          </button>
          <button type="button" onClick={() => onNavigate("followers")}>
            จัดการผู้ติดตาม
          </button>
        </div>
      </div>
    </section>
  );
}
