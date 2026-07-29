import { useEffect, useMemo, useState } from "react";
import { ClipboardPlus, X } from "lucide-react";
import {
  createStaffItemUseRequest,
  getItemRequestFormOptions,
} from "./itemRequestService";

const requestTypes = [
  { value: "self", label: "ใช้กับตัวเอง" },
  { value: "target", label: "ใช้กับตัวละครอื่น" },
  { value: "secret_plan", label: "แผนลับ / ใส่ร้าย" },
  { value: "shared_plot", label: "พล็อตที่ตกลงร่วมกัน" },
  { value: "unlock", label: "เปิดอีเวนต์หรือพื้นที่" },
  { value: "defense", label: "ป้องกันหรือรักษา" },
];

export function CreateItemRequestModal({ onClose, onCreated }) {
  const [characters, setCharacters] = useState([]);
  const [items, setItems] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    requesterCharacterId: "",
    itemId: "",
    quantity: 1,
    requestType: "self",
    targetCharacterId: "",
    actorName: "",
    useChannel: "",
    desiredEffect: "",
    details: "",
    roleUrl: "",
    secrecyLevel: "normal",
  });

  useEffect(() => {
    let active = true;
    getItemRequestFormOptions().then((results) => {
      if (!active) return;
      const optionError =
        results.characters.error ||
        results.items.error ||
        results.inventory.error;
      if (optionError) setError("โหลดตัวเลือกสำหรับคำร้องไม่สำเร็จ");
      setCharacters(results.characters.data || []);
      setItems(results.items.data || []);
      setInventory(results.inventory.data || []);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const availableItems = useMemo(() => {
    if (!form.requesterCharacterId) return [];
    const owned = new Map(
      inventory
        .filter(
          (row) =>
            String(row.character_id) === String(form.requesterCharacterId),
        )
        .map((row) => [row.item_name, row.quantity]),
    );
    return items
      .filter((item) => owned.has(item.name))
      .map((item) => ({ ...item, ownedQuantity: owned.get(item.name) }));
  }, [form.requesterCharacterId, inventory, items]);

  const selectedItem = availableItems.find(
    (item) => String(item.id) === String(form.itemId),
  );
  const needsTarget = ["target", "secret_plan", "shared_plot"].includes(
    form.requestType,
  );

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.requesterCharacterId || !form.itemId || !form.desiredEffect.trim()) {
      setError("กรุณากรอกตัวละคร ไอเท็ม และผลที่ต้องการ");
      return;
    }
    if (needsTarget && !form.targetCharacterId) {
      setError("คำร้องประเภทนี้ต้องระบุตัวละครเป้าหมาย");
      return;
    }

    setSubmitting(true);
    setError("");
    const { data, error: createError } = await createStaffItemUseRequest({
      ...form,
      requesterCharacterId: Number(form.requesterCharacterId),
      targetCharacterId: form.targetCharacterId
        ? Number(form.targetCharacterId)
        : null,
      itemId: Number(form.itemId),
      quantity: Number(form.quantity),
    });
    setSubmitting(false);

    if (createError) {
      setError(
        createError.message?.includes("enough")
          ? "ตัวละครมีไอเท็มชิ้นนี้ไม่เพียงพอ"
          : createError.message || "เพิ่มคำร้องไม่สำเร็จ",
      );
      return;
    }
    onCreated(data);
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="item-request-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-request-title"
      >
        <button
          type="button"
          className="modal-close"
          aria-label="ปิด"
          onClick={onClose}
        >
          <X size={19} />
        </button>
        <div className="request-modal-icon">
          <ClipboardPlus size={21} />
        </div>
        <h2 id="item-request-title">เพิ่มคำร้องใช้ไอเท็ม</h2>
        <p>สำหรับสต๊าฟลงคำร้องแทนผู้เล่นในช่วงที่เว็บลูกมูยังไม่เปิดใช้</p>

        <form onSubmit={submit}>
          <div className="request-form-grid">
            <label>
              ตัวละครผู้ขอ
              <select
                required
                disabled={loading}
                value={form.requesterCharacterId}
                onChange={(event) => {
                  update("requesterCharacterId", event.target.value);
                  update("itemId", "");
                }}
              >
                <option value="">เลือกตัวละคร</option>
                {characters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.character_name} · {character.player_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              ไอเท็ม
              <select
                required
                disabled={!form.requesterCharacterId}
                value={form.itemId}
                onChange={(event) => {
                  const item = availableItems.find(
                    (option) => String(option.id) === event.target.value,
                  );
                  update("itemId", event.target.value);
                  if (item?.default_channel) {
                    update("useChannel", item.default_channel);
                  }
                }}
              >
                <option value="">
                  {form.requesterCharacterId
                    ? "เลือกจากคลังตัวละคร"
                    : "เลือกตัวละครก่อน"}
                </option>
                {availableItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · มี {item.ownedQuantity}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="request-form-grid">
            <label>
              ประเภทคำร้อง
              <select
                value={form.requestType}
                onChange={(event) => update("requestType", event.target.value)}
              >
                {requestTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              จำนวน
              <input
                type="number"
                min="1"
                max={selectedItem?.ownedQuantity || 1}
                value={form.quantity}
                onChange={(event) => update("quantity", event.target.value)}
              />
            </label>
          </div>

          {needsTarget && (
            <label>
              ตัวละครเป้าหมาย
              <select
                required
                value={form.targetCharacterId}
                onChange={(event) =>
                  update("targetCharacterId", event.target.value)
                }
              >
                <option value="">เลือกเป้าหมาย</option>
                {characters
                  .filter(
                    (character) =>
                      String(character.id) !==
                      String(form.requesterCharacterId),
                  )
                  .map((character) => (
                    <option key={character.id} value={character.id}>
                      {character.character_name} · {character.player_name}
                    </option>
                  ))}
              </select>
            </label>
          )}

          <div className="request-form-grid">
            <label>
              NPC ผู้ดำเนินการ (ถ้ามี)
              <input
                value={form.actorName}
                placeholder="เช่น หมอหลวง ขันทีส่งของ"
                onChange={(event) => update("actorName", event.target.value)}
              />
            </label>
            <label>
              ช่องทาง
              <input
                value={form.useChannel}
                placeholder="ยา อาหาร ข่าวสาร ห้องพัก..."
                onChange={(event) => update("useChannel", event.target.value)}
              />
            </label>
          </div>

          <label>
            ผลที่ต้องการ
            <input
              required
              value={form.desiredEffect}
              placeholder="เช่น เพิ่มโปรดปราน หรือปล่อยข่าวในตำหนัก"
              onChange={(event) => update("desiredEffect", event.target.value)}
            />
          </label>

          <label>
            รายละเอียดแผน
            <textarea
              rows="3"
              value={form.details}
              placeholder="บริบท วิธีใช้ ขอบเขตผล และข้อมูลที่แม่งานควรรู้"
              onChange={(event) => update("details", event.target.value)}
            />
          </label>

          <div className="request-form-grid">
            <label>
              ลิงก์โรลหรือหลักฐาน
              <input
                type="url"
                value={form.roleUrl}
                placeholder="https://..."
                onChange={(event) => update("roleUrl", event.target.value)}
              />
            </label>
            <label>
              การเปิดเผย
              <select
                value={form.secrecyLevel}
                onChange={(event) =>
                  update("secrecyLevel", event.target.value)
                }
              >
                <option value="normal">ปกติ</option>
                <option value="staff_only">เฉพาะสต๊าฟ</option>
                <option value="anonymous">ไม่เปิดเผยผู้วางแผน</option>
              </select>
            </label>
          </div>

          {error && <p className="request-form-error">{error}</p>}

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
              disabled={submitting || loading}
            >
              {submitting ? "กำลังเพิ่ม..." : "เพิ่มและจองไอเท็ม"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
