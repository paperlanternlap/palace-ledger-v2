import { useState } from "react";
import { PackagePlus, Plus, Settings2, Trash2, X } from "lucide-react";
import {
  adjustItemStock,
  createCatalogItem,
  updateCatalogItem,
} from "./inventoryService";

const itemCategories = [
  { value: "general", label: "ของใช้ทั่วไป" },
  { value: "favor", label: "เพิ่มโปรดปราน" },
  { value: "medicine", label: "ยาและการรักษา" },
  { value: "secret", label: "แผนลับ / ใส่ร้าย" },
  { value: "access", label: "เปิดพื้นที่หรืออีเวนต์" },
  { value: "defense", label: "ป้องกัน" },
  { value: "story", label: "ไอเท็มเนื้อเรื่อง" },
];

function normalizeTasks(tasks) {
  if (!Array.isArray(tasks)) return [];
  return tasks
    .map((task) =>
      typeof task === "string"
        ? { label: task, type: "staff_action" }
        : {
            label: task?.label || "",
            type: task?.type || "staff_action",
          },
    )
    .filter((task) => task.label);
}

export function CreateItemModal({ onClose, onSaved }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState(0);
  const [priceCurrency, setPriceCurrency] = useState("rp");
  const [fulfillmentType, setFulfillmentType] = useState("inventory");
  const [shopAvailable, setShopAvailable] = useState(false);
  const [isLimited, setIsLimited] = useState(false);
  const [stockQuantity, setStockQuantity] = useState(0);
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const { error: createError } = await createCatalogItem({
      name: name.trim(),
      description: description.trim(),
      cost: Number(cost) || 0,
      priceCurrency,
      fulfillmentType,
      shopAvailable,
      isLimited,
      stockQuantity: Number(stockQuantity) || 0,
      lowStockThreshold: Number(lowStockThreshold) || 0,
    });
    setSubmitting(false);

    if (createError) {
      setError(
        createError.code === "23505"
          ? "มีไอเท็มชื่อนี้อยู่แล้ว"
          : createError.message || "สร้างไอเท็มไม่สำเร็จ",
      );
      return;
    }
    onSaved();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="item-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-item-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={onClose}>
          <X size={20} />
        </button>
        <div className="item-modal-icon">
          <PackagePlus size={21} />
        </div>
        <h2 id="create-item-title">สร้างไอเท็มใหม่</h2>
        <p>เพิ่มไอเท็มเข้าสู่คลังกลางสำหรับแจกหรือใช้ในอีเวนต์</p>

        <form onSubmit={handleSubmit}>
          <label>
            ชื่อไอเท็ม
            <input
              required
              value={name}
              placeholder="เช่น หยกมงคล"
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            รายละเอียด
            <textarea
              rows="3"
              value={description}
              placeholder="คำอธิบายหรือวิธีใช้..."
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <div className="item-form-grid">
            <label>
              ราคา
              <input
                type="number"
                min="0"
                value={cost}
                onChange={(event) => setCost(event.target.value)}
              />
            </label>
            <label>
              ใช้แต้ม
              <select
                value={priceCurrency}
                onChange={(event) => setPriceCurrency(event.target.value)}
              >
                <option value="rp">RP</option>
                <option value="favor">โปรดปราน</option>
              </select>
            </label>
          </div>

          <label>
            ซื้อแล้วได้รับ
            <select
              value={fulfillmentType}
              onChange={(event) => setFulfillmentType(event.target.value)}
            >
              <option value="inventory">ไอเท็มเข้าคลัง — กดใช้ภายหลัง</option>
              <option value="staff_request">
                เหตุการณ์พิเศษ — สร้างงานให้สต๊าฟทันที
              </option>
            </select>
          </label>

          <label className="stock-toggle">
            <input
              type="checkbox"
              checked={shopAvailable}
              onChange={(event) => setShopAvailable(event.target.checked)}
            />
            <span>
              <strong>แสดงในร้านลูกมู</strong>
              <small>ปิดไว้สำหรับของเนื้อเรื่องหรือของที่แจกโดยสต๊าฟเท่านั้น</small>
            </span>
          </label>

          <label className="stock-toggle">
            <input
              type="checkbox"
              checked={isLimited}
              onChange={(event) => setIsLimited(event.target.checked)}
            />
            <span>
              <strong>จำกัดจำนวน</strong>
              <small>เปิดเมื่อต้องการควบคุมสต็อกและป้องกันแจกเกิน</small>
            </span>
          </label>

          {isLimited && (
            <div className="item-number-grid">
              <label>
                จำนวนเริ่มต้น
                <input
                  type="number"
                  min="0"
                  value={stockQuantity}
                  onChange={(event) => setStockQuantity(event.target.value)}
                />
              </label>
              <label>
                แจ้งเตือนเมื่อเหลือ
                <input
                  type="number"
                  min="0"
                  value={lowStockThreshold}
                  onChange={(event) =>
                    setLowStockThreshold(event.target.value)
                  }
                />
              </label>
            </div>
          )}

          {error && <p className="inventory-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              ยกเลิก
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={submitting || !name.trim()}
            >
              {submitting ? "กำลังสร้าง..." : "สร้างไอเท็ม"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function AdjustStockModal({ item, onClose, onSaved }) {
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    const quantityChange = Number(quantity);
    if (!quantityChange) {
      setError("กรุณาใส่จำนวนที่ต้องการเพิ่มหรือลด");
      return;
    }

    setSubmitting(true);
    setError("");
    const { error: adjustError } = await adjustItemStock(
      item.id,
      quantityChange,
      note.trim(),
    );
    setSubmitting(false);

    if (adjustError) {
      setError(
        adjustError.message?.includes("Insufficient stock")
          ? "จำนวนคงเหลือไม่พอสำหรับการลดสต็อก"
          : adjustError.message || "ปรับสต็อกไม่สำเร็จ",
      );
      return;
    }
    onSaved();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="item-modal compact"
        role="dialog"
        aria-modal="true"
        aria-labelledby="adjust-stock-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={onClose}>
          <X size={20} />
        </button>
        <h2 id="adjust-stock-title">ปรับสต็อก · {item.name}</h2>
        <p>
          คงเหลือปัจจุบัน <strong>{item.stock_quantity}</strong> ชิ้น
        </p>

        <form onSubmit={handleSubmit}>
          <label>
            จำนวนที่เปลี่ยน
            <input
              type="number"
              required
              autoFocus
              value={quantity}
              placeholder="เช่น 10 หรือ -2"
              onChange={(event) => setQuantity(event.target.value)}
            />
            <small>ใช้เลขบวกเพื่อเติม และเลขลบเพื่อลด</small>
          </label>
          <label>
            เหตุผล
            <textarea
              rows="3"
              required
              value={note}
              placeholder="เช่น เติมสต็อกประจำเดือน..."
              onChange={(event) => setNote(event.target.value)}
            />
          </label>

          {error && <p className="inventory-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              ยกเลิก
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={submitting || !quantity || !note.trim()}
            >
              {submitting ? "กำลังบันทึก..." : "บันทึกสต็อก"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function EditItemModal({ item, onClose, onSaved }) {
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description || "");
  const [cost, setCost] = useState(item.cost || 0);
  const [priceCurrency, setPriceCurrency] = useState(
    item.price_currency || "rp",
  );
  const [fulfillmentType, setFulfillmentType] = useState(
    item.fulfillment_type || "inventory",
  );
  const [shopAvailable, setShopAvailable] = useState(
    Boolean(item.shop_available),
  );
  const [useCategory, setUseCategory] = useState(
    item.use_category || "general",
  );
  const [defaultChannel, setDefaultChannel] = useState(
    item.default_channel || "",
  );
  const [requiresTarget, setRequiresTarget] = useState(
    Boolean(item.requires_target),
  );
  const [requiresRoll, setRequiresRoll] = useState(
    Boolean(item.requires_roll),
  );
  const [active, setActive] = useState(item.active !== false);
  const [tasks, setTasks] = useState(() =>
    normalizeTasks(item.action_template),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function addTask() {
    setTasks((current) => [
      ...current,
      { label: "", type: "staff_action" },
    ]);
  }

  function updateTask(index, field, value) {
    setTasks((current) =>
      current.map((task, taskIndex) =>
        taskIndex === index ? { ...task, [field]: value } : task,
      ),
    );
  }

  function removeTask(index) {
    setTasks((current) =>
      current.filter((_, taskIndex) => taskIndex !== index),
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const cleanTasks = tasks
      .map((task) => ({ ...task, label: task.label.trim() }))
      .filter((task) => task.label);

    setSubmitting(true);
    setError("");
    const { error: updateError } = await updateCatalogItem({
      id: item.id,
      name: name.trim(),
      description: description.trim(),
      cost: Number(cost) || 0,
      priceCurrency,
      fulfillmentType,
      shopAvailable,
      useCategory,
      defaultChannel: defaultChannel.trim(),
      requiresTarget,
      requiresRoll,
      actionTemplate: cleanTasks,
      active,
    });
    setSubmitting(false);

    if (updateError) {
      setError(
        updateError.code === "23505"
          ? "มีไอเท็มชื่อนี้อยู่แล้ว"
          : updateError.message || "บันทึกรายละเอียดไม่สำเร็จ",
      );
      return;
    }
    onSaved();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="item-modal wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-item-title"
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
        <div className="item-modal-icon">
          <Settings2 size={21} />
        </div>
        <h2 id="edit-item-title">ตั้งค่าไอเท็ม</h2>
        <p>
          ข้อมูลส่วนนี้ใช้สร้างฟอร์มและ checklist เมื่อมีคำร้องใช้ไอเท็ม
        </p>

        <form onSubmit={handleSubmit}>
          <div className="item-form-grid">
            <label>
              ชื่อไอเท็ม
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              ประเภทการใช้งาน
              <select
                value={useCategory}
                onChange={(event) => setUseCategory(event.target.value)}
              >
                {itemCategories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="item-form-grid">
            <label>
              ราคา
              <input
                type="number"
                min="0"
                value={cost}
                onChange={(event) => setCost(event.target.value)}
              />
            </label>
            <label>
              ใช้แต้ม
              <select
                value={priceCurrency}
                onChange={(event) => setPriceCurrency(event.target.value)}
              >
                <option value="rp">RP</option>
                <option value="favor">โปรดปราน</option>
              </select>
            </label>
          </div>

          <label>
            ซื้อแล้วได้รับ
            <select
              value={fulfillmentType}
              onChange={(event) => setFulfillmentType(event.target.value)}
            >
              <option value="inventory">ไอเท็มเข้าคลัง — กดใช้ภายหลัง</option>
              <option value="staff_request">
                เหตุการณ์พิเศษ — สร้างงานให้สต๊าฟทันที
              </option>
            </select>
          </label>

          <label className="stock-toggle">
            <input
              type="checkbox"
              checked={shopAvailable}
              onChange={(event) => setShopAvailable(event.target.checked)}
            />
            <span>
              <strong>แสดงในร้านลูกมู</strong>
              <small>
                ลูกมูจะเห็นและซื้อได้เฉพาะเมื่อเปิดตัวเลือกนี้และไอเท็มยังใช้งานอยู่
              </small>
            </span>
          </label>

          <label>
            รายละเอียดและผลของไอเท็ม
            <textarea
              rows="3"
              value={description}
              placeholder="อธิบายผล เงื่อนไข หรือข้อจำกัด..."
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <label>
            ช่องทางเริ่มต้น
            <input
              value={defaultChannel}
              placeholder="เช่น ยา อาหาร ข่าวสาร หรือห้องพัก"
              onChange={(event) => setDefaultChannel(event.target.value)}
            />
          </label>

          <div className="item-rule-toggles">
            <label>
              <input
                type="checkbox"
                checked={requiresTarget}
                onChange={(event) => setRequiresTarget(event.target.checked)}
              />
              <span>
                <strong>ต้องมีเป้าหมาย</strong>
                <small>บังคับระบุตัวละครที่ได้รับผล</small>
              </span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={requiresRoll}
                onChange={(event) => setRequiresRoll(event.target.checked)}
              />
              <span>
                <strong>ต้องรอการทอย</strong>
                <small>เพิ่มงานรอผู้เล่นตอบหรือทอยให้อัตโนมัติ</small>
              </span>
            </label>
          </div>

          <div className="item-template-editor">
            <div>
              <span>
                <strong>Checklist เฉพาะไอเท็ม</strong>
                <small>ระบบจะเพิ่มงานเหล่านี้ให้ทุกคำร้องของไอเท็มชิ้นนี้</small>
              </span>
              <button type="button" onClick={addTask}>
                <Plus size={14} /> เพิ่มขั้นตอน
              </button>
            </div>

            {tasks.length ? (
              <div className="item-template-tasks">
                {tasks.map((task, index) => (
                  <div key={`${index}-${task.type}`}>
                    <input
                      value={task.label}
                      aria-label={`รายละเอียดขั้นตอนที่ ${index + 1}`}
                      placeholder="เช่น เพิ่มโปรดปรานให้ตัวละคร"
                      onChange={(event) =>
                        updateTask(index, "label", event.target.value)
                      }
                    />
                    <select
                      value={task.type}
                      aria-label={`ผู้รับผิดชอบขั้นตอนที่ ${index + 1}`}
                      onChange={(event) =>
                        updateTask(index, "type", event.target.value)
                      }
                    >
                      <option value="staff_action">งานแม่งาน</option>
                      <option value="player_action">รอผู้เล่น</option>
                      <option value="validation">ขั้นตรวจสอบ</option>
                    </select>
                    <button
                      type="button"
                      aria-label={`ลบขั้นตอนที่ ${index + 1}`}
                      onClick={() => removeTask(index)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p>ยังไม่มีขั้นตอนเฉพาะ ระบบจะใช้ checklist พื้นฐาน</p>
            )}
          </div>

          <label className="stock-toggle">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            <span>
              <strong>เปิดให้ใช้งาน</strong>
              <small>ปิดเพื่อซ่อนไอเท็มโดยไม่ลบข้อมูลหรือประวัติ</small>
            </span>
          </label>

          {error && <p className="inventory-error">{error}</p>}

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
              disabled={submitting || !name.trim()}
            >
              {submitting ? "กำลังบันทึก..." : "บันทึกรายละเอียด"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
