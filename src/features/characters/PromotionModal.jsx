import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getNextPosition } from "./characterService";
import { formatNumber } from "./utils";

export function PromotionModal({ character, submitting, onClose, onSubmit }) {
  const [requirement, setRequirement] = useState(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNextPosition(character.position).then(({ data }) => {
      setRequirement(data || null);
      setLoading(false);
    });
  }, [character.position]);

  const enoughFavor =
    requirement && Number(character.favor) >= Number(requirement.favor_required);
  const promotionLocked = Boolean(character.promotion_locked);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal-card" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="ปิด">
          <X size={20} />
        </button>
        <span className="eyebrow">จัดการตำแหน่ง</span>
        <h2>เลื่อนขั้น {character.character_name}</h2>

        {loading ? (
          <p className="modal-description">กำลังตรวจสอบลำดับขั้น...</p>
        ) : requirement ? (
          <form onSubmit={(event) => {
            event.preventDefault();
            onSubmit({ note: note.trim() });
          }}>
            <div className="promotion-confirm-route">
              <strong>{character.position}</strong>
              <span>เลื่อนเป็น</span>
              <strong>{requirement.next_position}</strong>
            </div>
            <div className="promotion-cost-summary">
              <div><span>โปรดปรานปัจจุบัน</span><strong>{formatNumber(character.favor)}</strong></div>
              <div><span>ใช้ในการเลื่อนขั้น</span><strong>-{formatNumber(requirement.favor_required)}</strong></div>
              <div><span>คงเหลือ</span><strong>{formatNumber(character.favor - requirement.favor_required)}</strong></div>
            </div>
            {requirement.max_slots && (
              <p className="form-hint">ตำแหน่งนี้รับได้สูงสุด {requirement.max_slots} คน ระบบจะตรวจสล็อตอีกครั้งเมื่อยืนยัน</p>
            )}
            {!enoughFavor && (
              <p className="danger-hint">โปรดปรานไม่เพียงพอสำหรับการเลื่อนขั้น</p>
            )}
            {promotionLocked && (
              <p className="danger-hint">
                ตัวละครถูกระงับสิทธิ์เลื่อนขั้นด้วยโปรดปราน
                {character.promotion_lock_reason ? ` · ${character.promotion_lock_reason}` : ""}
              </p>
            )}
            <label>
              เหตุผลหรือที่มา
              <textarea rows="3" required value={note} onChange={(event) => setNote(event.target.value)} />
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={onClose}>ยกเลิก</button>
              <button type="submit" className="primary-button" disabled={submitting || promotionLocked || !enoughFavor || !note.trim()}>
                {submitting ? "กำลังบันทึก..." : "ยืนยันการเลื่อนขั้น"}
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="modal-description">ตำแหน่งนี้เป็นขั้นสูงสุดหรือไม่มีลำดับถัดไปในระบบ</p>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={onClose}>ปิด</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
