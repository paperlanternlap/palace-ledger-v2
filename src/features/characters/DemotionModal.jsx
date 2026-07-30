import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getPreviousPosition } from "./characterService";

export function DemotionModal({ character, submitting, onClose, onSubmit }) {
  const [previousPosition, setPreviousPosition] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPreviousPosition(character.position).then(({ data }) => {
      setPreviousPosition(data?.current_position || "");
      setLoading(false);
    });
  }, [character.position]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal-card" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="ปิด">
          <X size={20} />
        </button>
        <span className="eyebrow">จัดการตำแหน่ง</span>
        <h2>ลดขั้น {character.character_name}</h2>
        {loading ? (
          <p className="modal-description">กำลังตรวจสอบลำดับขั้น...</p>
        ) : previousPosition ? (
          <form onSubmit={(event) => {
            event.preventDefault();
            onSubmit({ note: note.trim() });
          }}>
            <div className="demotion-route">
              <strong>{character.position}</strong><span>ลดเป็น</span><strong>{previousPosition}</strong>
            </div>
            <label>
              เหตุผล
              <textarea rows="3" required value={note} onChange={(event) => setNote(event.target.value)} />
            </label>
            <p className="danger-hint">กรุณาตรวจสอบให้ถูกต้อง ระบบจะบันทึกการลดขั้นในประวัติตัวละคร</p>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={onClose}>ยกเลิก</button>
              <button type="submit" className="danger-button" disabled={submitting || !note.trim()}>
                {submitting ? "กำลังบันทึก..." : "ยืนยันการลดขั้น"}
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="modal-description">ตำแหน่งนี้เป็นขั้นเริ่มต้นหรือไม่มีลำดับที่ต่ำกว่าในระบบ</p>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={onClose}>ปิด</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
