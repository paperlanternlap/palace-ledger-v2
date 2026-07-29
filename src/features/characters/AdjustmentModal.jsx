import { useState } from "react";
import { X } from "lucide-react";

export function AdjustmentModal({
  type,
  character,
  submitting,
  onClose,
  onSubmit,
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const isRp = type === "rp";

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({ amount: Number(amount), note: note.trim() });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="adjustment-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="ปิดหน้าต่าง"
        >
          <X size={20} />
        </button>

        <span className="eyebrow">บันทึกการเปลี่ยนแปลง</span>
        <h2 id="adjustment-title">
          เพิ่ม{isRp ? " RP" : "ความโปรดปราน"}
        </h2>
        <p className="modal-description">
          ให้แก่ <strong>{character.character_name}</strong>
        </p>

        <form onSubmit={handleSubmit}>
          <label>
            จำนวน
            <input
              type="number"
              min="1"
              step="1"
              autoFocus
              required
              placeholder="0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <label>
            เหตุผลหรือแหล่งที่มา
            <textarea
              rows="3"
              required
              placeholder="เช่น โรลประจำสัปดาห์ หรือรางวัลจากอีเวนต์..."
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              ยกเลิก
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={submitting || !amount || !note.trim()}
            >
              {submitting ? "กำลังบันทึก..." : "ยืนยันการเพิ่ม"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
