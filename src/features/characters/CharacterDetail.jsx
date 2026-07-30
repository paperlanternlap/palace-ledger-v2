import { useEffect, useState } from "react";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  PackageOpen,
} from "lucide-react";
import { EmptyState } from "../../components/ui/EmptyState";
import { formatNumber } from "./utils";

function Inventory({ items, loading }) {
  if (loading) return <p className="muted">กำลังโหลด...</p>;
  if (!items.length) return <p className="muted">ตัวละครนี้ยังไม่มีไอเท็ม</p>;

  return items.map((item) => (
    <div className="inventory-row" key={item.id}>
      <span>{item.item_name}</span>
      <strong>×{formatNumber(item.quantity)}</strong>
    </div>
  ));
}

function getHistoryPageSize() {
  if (typeof window === "undefined") return 4;
  if (window.innerHeight < 720) return 3;
  if (window.innerHeight < 900) return 4;
  return 6;
}

function History({ items, loading }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(getHistoryPageSize);

  useEffect(() => {
    const handleResize = () => setPageSize(getHistoryPageSize());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (loading) return <p className="muted">กำลังโหลด...</p>;
  if (!items.length) return <p className="muted">ยังไม่มีประวัติการทำรายการ</p>;

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleItems = items.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return (
    <div className="history-content">
      <div className="history-list">
        {visibleItems.map((log) => (
          <div className="history-row" key={log.id}>
            <span className={`history-dot ${log.type || ""}`} />
            <div>
              <strong>{log.value}</strong>
              <p>{log.action}</p>
            </div>
            <time>
              {new Date(log.created_at).toLocaleString("th-TH", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </time>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <nav className="pagination" aria-label="หน้าประวัติกิจกรรม">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
            aria-label="หน้าก่อนหน้า"
          >
            <ChevronLeft size={15} />
          </button>
          <span>
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => setPage(currentPage + 1)}
            aria-label="หน้าถัดไป"
          >
            <ChevronRight size={15} />
          </button>
        </nav>
      )}
    </div>
  );
}

export function CharacterDetail({
  character,
  inventory,
  history,
  loading,
  onAdjust,
  onGrantItem,
  onPromote,
  onDemote,
  onSpecialAppointment,
}) {
  if (!character) {
    return (
      <section className="detail-card">
        <EmptyState
          title="เลือกตัวละครเพื่อดูข้อมูล"
          description="เลือกรายชื่อจากด้านซ้ายเพื่อดูคะแนน คลังไอเท็ม และประวัติการทำรายการ"
        />
      </section>
    );
  }

  return (
    <section className="detail-card">
      <header className="profile-header">
        {character.avatar_url ? (
          <img
            className="profile-avatar"
            src={character.avatar_url}
            alt=""
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="profile-avatar profile-placeholder">
            {(character.character_name || "?").slice(0, 1)}
          </div>
        )}

        <div className="profile-title">
          <div className="profile-name">
            <h2>{character.character_name || "ยังไม่มีชื่อ"}</h2>
          </div>
          <p>{character.role || "ยังไม่ระบุบทบาท"}</p>
          <div className="profile-meta flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-baseline gap-1">
              ผู้เล่น: <strong>{character.player_name || "—"}</strong>
            </span>
            <span className="inline-flex items-baseline gap-1">
              ตำแหน่ง: <strong>{character.position || "—"}</strong>
            </span>
            <span className="inline-flex items-baseline gap-1">
              ตำหนัก: <strong>{character.palace || "—"}</strong>
            </span>
          </div>
        </div>

        <div className="score-summary flex items-center gap-2" aria-label="คะแนนตัวละคร">
          <div className="flex min-h-9 min-w-20 items-baseline justify-between gap-2 rounded-lg border border-[#d7dfc8] bg-[#f1f4e9] px-3 py-2 text-[#52643d]">
            <span className="text-[10px] opacity-75">RP</span>
            <strong className="text-[17px] leading-none">
              {formatNumber(character.rp)}
            </strong>
          </div>
          <div className="flex min-h-9 min-w-28 items-baseline justify-between gap-2 rounded-lg border border-[#ead5d0] bg-[#fbefec] px-3 py-2 text-[#8b4642]">
            <span className="text-[10px] opacity-75">โปรดปราน</span>
            <strong className="text-[17px] leading-none">
              {formatNumber(character.favor)}
            </strong>
          </div>
        </div>
      </header>

      <div className="character-action-groups">
        <section className="character-action-group">
          <div className="character-action-group__heading">
            <strong>ทรัพยากรตัวละคร</strong>
            <span>เพิ่ม ลด และแก้ไขยอดที่ตัวละครถืออยู่</span>
          </div>
          <div className="quick-actions resource-actions">
            <button type="button" onClick={() => onAdjust("rp")}>
              <span>จัดการ RP</span>
              <small>เพิ่มหรือหักคะแนน</small>
            </button>
            <button type="button" onClick={() => onAdjust("favor")}>
              <span>จัดการโปรดปราน</span>
              <small>เพิ่มหรือหักค่าโปรดปราน</small>
            </button>
            <button type="button" onClick={onGrantItem}>
              <span>จัดการไอเท็ม</span>
              <small>เพิ่ม ลด หรือลบออกจากคลัง</small>
            </button>
          </div>
        </section>

        <section className="character-action-group rank-action-group">
          <div className="character-action-group__heading">
            <strong>ตำแหน่งและพระราชโองการ</strong>
            <span>จัดการลำดับขั้นหรือเปลี่ยนบทบาทเป็นกรณีพิเศษ</span>
          </div>
          <div className="quick-actions rank-actions">
            <button type="button" className="promote-action" onClick={onPromote}>
              <span>เลื่อนขั้น</span>
              <small>ตรวจโปรดปรานและสล็อตตำแหน่ง</small>
            </button>
            <button type="button" className="danger-action" onClick={onDemote}>
              <span>ลดขั้น</span>
              <small>ลดตำแหน่งลงหนึ่งลำดับ</small>
            </button>
            <button type="button" className="special-action" onClick={onSpecialAppointment}>
              <span>แต่งตั้งพิเศษ</span>
              <small>ข้ามบทบาทหรือลดขั้นโดยพระราชโองการ</small>
            </button>
          </div>
        </section>
      </div>

      <div className="detail-sections">
        <section className="sub-card">
          <div className="section-heading">
            <div>
              <PackageOpen size={18} />
              <h3>คลังเก็บของ</h3>
            </div>
            <span>{inventory.length} รายการ</span>
          </div>
          <div className="scroll-area">
            <Inventory items={inventory} loading={loading} />
          </div>
        </section>

        <section className="sub-card activity-card">
          <div className="section-heading">
            <div>
              <Activity size={18} />
              <h3>กิจกรรมล่าสุด</h3>
            </div>
            <span>{history.length} รายการ</span>
          </div>
          <div className="scroll-area">
            <History
              key={character.id}
              items={history}
              loading={loading}
            />
          </div>
        </section>
      </div>
    </section>
  );
}
