import { useEffect, useMemo, useState } from "react";
import { Gift, Infinity as InfinityIcon, X } from "lucide-react";
import {
  getGrantableItems,
  grantItemToCharacter,
} from "./characterService";

export function GrantItemModal({ character, onClose, onSaved }) {
  const [items, setItems] = useState([]);
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getGrantableItems().then(({ data, error: loadError }) => {
      if (!active) return;
      setItems(data || []);
      if (loadError) setError("โหลดรายการไอเท็มไม่สำเร็จ");
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const selectedItem = useMemo(
    () => items.find((item) => String(item.id) === String(itemId)),
    [itemId, items],
  );

  async function handleSubmit(event) {
    event.preventDefault();
    const amount = Number(quantity);
    if (!itemId || amount <= 0 || !note.trim()) {
      setError("กรุณาเลือกไอเท็ม ระบุจำนวน และเหตุผล");
      return;
    }

    setSubmitting(true);
    setError("");
    const { error: grantError } = await grantItemToCharacter({
      itemId: Number(itemId),
      characterId: character.id,
      quantity: amount,
      note: note.trim(),
    });
    setSubmitting(false);

    if (grantError) {
      setError(
        grantError.message?.includes("Insufficient stock")
          ? "สต็อกกลางของไอเท็มนี้ไม่เพียงพอ"
          : grantError.message || "เพิ่มไอเท็มไม่สำเร็จ",
      );
      return;
    }
    onSaved({
      itemName: selectedItem.name,
      quantity: amount,
      note: note.trim(),
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-card grant-character-item-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="grant-character-item-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="modal-close"
          aria-label="ปิด"
          onClick={onClose}
        >
          <X size={20} />
        </button>

        <div className="grant-item-modal-icon">
          <Gift size={21} />
        </div>
        <span className="eyebrow">คลังของตัวละคร</span>
        <h2 id="grant-character-item-title">
          เพิ่มไอเท็มให้ {character.character_name}
        </h2>
        <p className="modal-description">
          เลือกของจากคลังกลาง ระบบจะเพิ่มจำนวนให้ตัวละครและหักสต็อกให้อัตโนมัติ
        </p>

        <form onSubmit={handleSubmit}>
          <label>
            ไอเท็ม
            <select
              required
              autoFocus
              disabled={loading}
              value={itemId}
              onChange={(event) => {
                setItemId(event.target.value);
                setQuantity(1);
              }}
            >
              <option value="">
                {loading ? "กำลังโหลดรายการ..." : "เลือกไอเท็ม"}
              </option>
              {items.map((item) => (
                <option
                  key={item.id}
                  value={item.id}
                  disabled={item.is_limited && item.stock_quantity === 0}
                >
                  {item.name} ·{" "}
                  {item.is_limited
                    ? item.stock_quantity === 0
                      ? "หมด"
                      : `เหลือ ${item.stock_quantity}`
                    : "ไม่จำกัด"}
                </option>
              ))}
            </select>
          </label>

          {selectedItem && (
            <div
              className={`selected-grant-item ${
                selectedItem.is_limited ? "" : "unlimited"
              }`}
            >
              <div>
                <strong>{selectedItem.name}</strong>
                <span>{selectedItem.description || "ไม่มีรายละเอียด"}</span>
              </div>
              <div>
                <small>สต็อกกลาง</small>
                <strong>
                  {selectedItem.is_limited ? (
                    selectedItem.stock_quantity
                  ) : (
                    <InfinityIcon size={20} />
                  )}
                </strong>
              </div>
            </div>
          )}

          <label>
            จำนวน
            <input
              type="number"
              required
              min="1"
              max={
                selectedItem?.is_limited
                  ? selectedItem.stock_quantity
                  : undefined
              }
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>

          <label>
            เหตุผลหรือที่มา
            <textarea
              rows="3"
              required
              value={note}
              placeholder="เช่น รางวัลจากอีเวนต์ หรือชดเชยไอเท็ม"
              onChange={(event) => setNote(event.target.value)}
            />
          </label>

          {error && <p className="grant-item-error">{error}</p>}

          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={submitting}
              onClick={onClose}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={
                loading ||
                submitting ||
                !itemId ||
                !note.trim() ||
                (selectedItem?.is_limited &&
                  selectedItem.stock_quantity === 0)
              }
            >
              {submitting ? "กำลังเพิ่ม..." : "เพิ่มเข้าคลังตัวละคร"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
