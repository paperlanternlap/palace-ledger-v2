import { useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  CHARACTER_ROLE_OPTIONS,
  POSITION_OPTIONS_BY_ROLE,
} from "./rankOptions";

export function SpecialAppointmentModal({ character, submitting, onClose, onSubmit }) {
  const [action, setAction] = useState("appointment");
  const [role, setRole] = useState(character.role || "");
  const [position, setPosition] = useState(character.position || "");
  const [note, setNote] = useState("");
  const [restoreNormalPromotion, setRestoreNormalPromotion] = useState(false);
  const positions = useMemo(() => POSITION_OPTIONS_BY_ROLE[role] || [], [role]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal-card special-appointment-modal" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="ปิด"><X size={20} /></button>
        <span className="eyebrow">พระราชโองการ</span>
        <h2>แต่งตั้งหรือลดขั้นพิเศษ</h2>
        <p className="modal-description">ใช้สำหรับการเปลี่ยนบทบาท ข้ามสายตำแหน่ง หรือบทลงโทษพิเศษจากฮ่องเต้</p>
        <form onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ action, role, position, note: note.trim(), restoreNormalPromotion });
        }}>
          <div className="operation-toggle">
            <button type="button" className={action === "appointment" ? "active" : ""} onClick={() => setAction("appointment")}>
              แต่งตั้งพิเศษ
            </button>
            <button type="button" className={action === "imperial_demote" ? "active subtract" : ""} onClick={() => setAction("imperial_demote")}>
              ลดขั้นพิเศษ
            </button>
          </div>
          <div className="special-appointment-grid">
            <label>
              บทบาทใหม่
              <select value={role} required onChange={(event) => {
                const nextRole = event.target.value;
                setRole(nextRole);
                setPosition(POSITION_OPTIONS_BY_ROLE[nextRole]?.[0] || "");
              }}>
                <option value="">เลือกบทบาท</option>
                {CHARACTER_ROLE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              ตำแหน่งใหม่
              {positions.length ? (
                <select value={position} required onChange={(event) => setPosition(event.target.value)}>
                  <option value="">เลือกตำแหน่ง</option>
                  {positions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : (
                <input
                  value={position}
                  required
                  placeholder="ระบุตำแหน่งใหม่"
                  onChange={(event) => setPosition(event.target.value)}
                />
              )}
            </label>
          </div>
          <div className="special-change-preview">
            <span>{character.role} · {character.position}</span>
            <strong>{role || "—"} · {position || "—"}</strong>
          </div>
          {action === "imperial_demote" && (
            <p className="danger-hint">ตัวละครจะถูกปิดสิทธิ์เลื่อนขั้นด้วยโปรดปรานทันที และเลื่อนได้อีกครั้งเมื่อสต๊าฟคืนสิทธิ์เท่านั้น</p>
          )}
          {action === "appointment" && character.promotion_locked && (
            <label className="restore-promotion-check">
              <input type="checkbox" checked={restoreNormalPromotion} onChange={(event) => setRestoreNormalPromotion(event.target.checked)} />
              คืนสิทธิ์เลื่อนขั้นด้วยโปรดปราน
            </label>
          )}
          <label>
            เหตุผลหรือรายละเอียดพระราชโองการ
            <textarea rows="3" required value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className={action === "imperial_demote" ? "danger-button" : "primary-button"} disabled={submitting || !role || !position || !note.trim()}>
              {submitting ? "กำลังบันทึก..." : "ยืนยันพระราชโองการ"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
