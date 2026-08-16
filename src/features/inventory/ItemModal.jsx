import { useEffect, useState } from "react";
import { PackagePlus, Plus, Settings2, Trash2, X } from "lucide-react";
import {
  adjustItemStock,
  createCatalogItem,
  deleteCatalogItem,
  getAcquisitionChannels,
  updateCatalogItem,
} from "./inventoryService";
import {
  ACQUISITION_TYPES as acquisitionTypes,
  DEFAULT_ACQUISITION_SETTINGS as defaultAcquisitionSettings,
  ITEM_CATEGORIES as itemCategories,
  normalizeItemTasks as normalizeTasks,
} from "./itemFormConfig";

function AcquisitionFields({ value, onChange, sectionNumber, fulfillmentType }) {
  const [channels, setChannels] = useState([]);
  const set = (field, nextValue) => {
    const next = { ...value, [field]: nextValue };
    if (field === "acquisitionType") {
      if (nextValue === "palace_stock") {
        next.autoFulfill = true;
        next.acquisitionRequiresRoll = false;
      }
      if (nextValue === "external_legal") {
        next.autoFulfill = false;
        next.acquisitionRequiresRoll = false;
      }
      if (nextValue === "restricted") {
        next.catalogVisibility = "locked";
        next.autoFulfill = false;
        next.acquisitionRequiresRoll = true;
      }
      if (nextValue === "story_only") {
        next.catalogVisibility = "staff_only";
        next.autoFulfill = false;
        next.acquisitionRequiresRoll = false;
      }
      if (
        ["palace_stock", "external_legal"].includes(nextValue)
        && value.catalogVisibility === "locked"
      ) next.catalogVisibility = "public";
    }
    onChange(next);
  };

  useEffect(() => {
    let active = true;
    getAcquisitionChannels().then(({ data }) => {
      if (active) setChannels(data || []);
    });
    return () => { active = false; };
  }, []);

  const selectedChannel = channels.find(
    (channel) => channel.id === Number(value.acquisitionChannelId),
  );
  return (
    <fieldset className={`item-template-editor ${sectionNumber ? "create-item-section" : ""}`}>
      <div className="create-item-section__heading">
        {sectionNumber && <span className="create-item-section__number">{sectionNumber}</span>}
        <span>
          <strong>รายการนี้อยู่ในช่องทางใด</strong>
          <small>ตัวเลือกนี้กำหนดว่าผู้เล่นจะพบรายการที่ไหน และต้องผ่านเงื่อนไขใด</small>
        </span>
      </div>
      <div className="create-item-section__body">
      <label>
        ช่องทางได้รับ
        <select
          value={value.acquisitionType}
          onChange={(event) => set("acquisitionType", event.target.value)}
        >
          {acquisitionTypes.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </label>
      <div className="item-form-grid">
        <label>
          สถานะในหน้าผู้เล่น
          <select
            value={value.catalogVisibility}
            disabled={value.acquisitionType === "story_only"}
            onChange={(event) => set("catalogVisibility", event.target.value)}
          >
            <option value="public" disabled={value.acquisitionType === "restricted"}>
              เปิดให้เห็นและแลกได้
            </option>
            <option value="locked">แสดงไว้ แต่ต้องปลดล็อกก่อน</option>
            <option value="staff_only">เก็บเป็นฉบับร่าง — ผู้เล่นยังไม่เห็น</option>
          </select>
          {value.acquisitionType === "story_only" && (
            <small>ของจากเนื้อเรื่องจะไม่ปรากฏในหน้าสำหรับแลก</small>
          )}
          {value.acquisitionType === "restricted" && (
            <small>รายการจาก NPC จะแสดงได้เมื่อทีมงานบันทึกว่าตัวละครรู้จัก NPC แล้ว</small>
          )}
        </label>
        <label>
          โปรดปรานที่ต้องมีอย่างน้อย
          <input
            type="number"
            min="0"
            value={value.minimumFavor}
            onChange={(event) => set("minimumFavor", Number(event.target.value) || 0)}
          />
          <small>เป็นเงื่อนไขก่อนแลก ไม่ใช่แต้มที่ระบบหักเป็นราคา</small>
        </label>
      </div>
      {value.acquisitionType === "external_legal" && (
        <div className="create-item-route-note">
          <strong>ระบบเลือกวิธีจัดหาให้ตามตำแหน่ง</strong>
          <span>ผู้มีสิทธิ์จะออกคำสั่งจากตำหนัก ส่วนตำแหน่งอื่นจะส่งผ่านหน่วยจัดซื้อ</span>
        </div>
      )}
      {value.acquisitionType === "restricted" && (
        <>
          <label>
            ซื้อจาก NPC คนใด
            <select
              required
              value={value.acquisitionChannelId}
              onChange={(event) => set("acquisitionChannelId", event.target.value)}
            >
              <option value="">เลือก NPC</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.npc_name} · {channel.npc_role}
                </option>
              ))}
            </select>
          </label>
          {selectedChannel && (
            <div className="closed-request-note">
              <strong>{selectedChannel.npc_name} · {selectedChannel.npc_role}</strong>
              <p>{selectedChannel.access_reason}</p>
              <p>แรงจูงใจ: {selectedChannel.motivation}</p>
              <p>วิธีทำความรู้จัก: {selectedChannel.unlock_method}</p>
              <p>ความลับของ NPC: {selectedChannel.hidden_secret}</p>
            </div>
          )}
          <label>
            ระดับความเสี่ยง (1–5)
            <input
              type="number"
              min="1"
              max="5"
              value={value.acquisitionRiskLevel}
              onChange={(event) => set("acquisitionRiskLevel", Number(event.target.value) || 1)}
            />
          </label>
          <label>
            ผลเมื่อล้มเหลว
            <textarea
              rows="2"
              value={value.failureConsequence}
              onChange={(event) => set("failureConsequence", event.target.value)}
            />
          </label>
          <label>
            ผลเมื่อล้มเหลวร้ายแรง
            <textarea
              rows="2"
              value={value.criticalFailureConsequence}
              onChange={(event) => set("criticalFailureConsequence", event.target.value)}
            />
          </label>
        </>
      )}
      {fulfillmentType === "staff_request" ? (
        <div className="create-item-info-note">
          <strong>หลังแลก ระบบจะส่งงานให้สต๊าฟ</strong>
          <span>ระยะเวลาและผลของเหตุการณ์ให้ทีมงานกำหนดตอนดำเนินเรื่อง จึงไม่ต้องตั้งเวลาส่งของหรือการทอยในหน้านี้</span>
        </div>
      ) : (
        <>
          <div className="item-rule-toggles">
            {value.acquisitionType === "palace_stock" && (
              <label>
                <input
                  type="checkbox"
                  checked={value.autoFulfill}
                  onChange={(event) => set("autoFulfill", event.target.checked)}
                />
                <span>
                  <strong>ส่งเข้าคลังทันที</strong>
                  <small>เมื่อผู้เล่นกดรับ ระบบจะเพิ่มของให้ทันทีโดยไม่สร้างงานให้สต๊าฟ</small>
                </span>
              </label>
            )}
            {value.acquisitionType === "restricted" && (
              <label>
                <input
                  type="checkbox"
                  checked={value.acquisitionRequiresRoll}
                  onChange={(event) => set("acquisitionRequiresRoll", event.target.checked)}
                />
                <span>
                  <strong>ต้องทอยก่อนรับของ</strong>
                  <small>ใช้เมื่อตัวละครต้องเสี่ยงเพื่อติดต่อหรือจัดหาของชิ้นนี้</small>
                </span>
              </label>
            )}
          </div>
          {value.acquisitionType === "external_legal" && (
            <div className="create-item-duration">
              <div>
                <strong>กำหนดช่วงเวลาส่งเข้าคลัง</strong>
                <small>ระบบจะสุ่มกำหนดวันส่งมอบ เช่น 1–2 หมายถึงของจะเข้าในอีก 1 หรือ 2 วันจริง</small>
              </div>
              <div className="item-form-grid">
                <label>
                  อย่างเร็ว (วันจริง)
                  <input
                    type="number"
                    min="0"
                    value={value.fulfillmentDaysMin}
                    onChange={(event) => set("fulfillmentDaysMin", Number(event.target.value) || 0)}
                  />
                </label>
                <label>
                  ไม่เกิน (วันจริง)
                  <input
                    type="number"
                    min={value.fulfillmentDaysMin}
                    value={value.fulfillmentDaysMax}
                    onChange={(event) => set("fulfillmentDaysMax", Number(event.target.value) || 0)}
                  />
                </label>
              </div>
            </div>
          )}
          {value.acquisitionType === "palace_stock" && !value.autoFulfill && (
            <div className="create-item-info-note">
              <strong>รายการนี้จะส่งให้สต๊าฟตรวจ</strong>
              <span>ระบบจะไม่กำหนดวันส่งของอัตโนมัติ สต๊าฟเป็นผู้อนุมัติและเพิ่มของให้ภายหลัง</span>
            </div>
          )}
          {value.acquisitionType === "restricted" && (
            <div className="create-item-info-note">
              <strong>หลังเจรจาสำเร็จจะเข้าสู่ขั้นตอนจัดหา</strong>
              <span>ระบบยังไม่กำหนดวันรับของอัตโนมัติ สต๊าฟเป็นผู้ดำเนินผลและส่งของให้ภายหลัง</span>
            </div>
          )}
          {value.acquisitionRequiresRoll && (
            <label>
              โอกาสสำเร็จพื้นฐาน (%)
              <input
                type="number"
                min="5"
                max="95"
                value={value.acquisitionSuccessPercent}
                onChange={(event) => set("acquisitionSuccessPercent", Number(event.target.value) || 70)}
              />
            </label>
          )}
        </>
      )}
      </div>
    </fieldset>
  );
}

export function CreateItemModal({ onClose, onSaved }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState(0);
  const [priceCurrency, setPriceCurrency] = useState("rp");
  const [fulfillmentType, setFulfillmentType] = useState("inventory");
  const [isLimited, setIsLimited] = useState(false);
  const [stockQuantity, setStockQuantity] = useState(0);
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [acquisition, setAcquisition] = useState(() => ({
    ...defaultAcquisitionSettings,
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const shopAvailable = acquisition.catalogVisibility === "public"
    && acquisition.acquisitionType !== "story_only";

  const hasUnsavedChanges = Boolean(
    name.trim()
      || description.trim()
      || Number(cost)
      || priceCurrency !== "rp"
      || fulfillmentType !== "inventory"
      || isLimited
      || JSON.stringify(acquisition) !== JSON.stringify(defaultAcquisitionSettings),
  );

  function requestClose() {
    if (submitting) return;
    if (
      hasUnsavedChanges
      && !window.confirm("ยังไม่ได้บันทึกรายการนี้ ต้องการปิดและทิ้งข้อมูลที่กรอกหรือไม่")
    ) return;
    onClose();
  }

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
      ...acquisition,
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
    <div className="modal-backdrop" role="presentation" onMouseDown={requestClose}>
      <section
        className="item-modal wide create-item-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-item-title"
        aria-describedby="create-item-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal-close" aria-label="ปิดหน้าต่าง" onClick={requestClose}>
          <X size={20} />
        </button>
        <header className="create-item-header">
          <div className="item-modal-icon">
            <PackagePlus size={21} />
          </div>
          <div>
            <span className="create-item-eyebrow">คลังไอเท็ม</span>
            <h2 id="create-item-title">เพิ่มรายการใหม่</h2>
            <p id="create-item-description">กำหนดสิ่งที่ผู้เล่นเห็น วิธีแลก และสิ่งที่ระบบต้องทำหลังแลก</p>
          </div>
        </header>

        <form className="create-item-form" onSubmit={handleSubmit}>
          <fieldset className="create-item-section">
            <div className="create-item-section__heading">
              <span className="create-item-section__number">1</span>
              <span>
                <strong>ข้อมูลที่ผู้เล่นเห็น</strong>
                <small>ใช้ชื่อและคำอธิบายที่อ่านเข้าใจได้โดยไม่ต้องรู้คำศัพท์ของระบบ</small>
              </span>
            </div>
            <div className="create-item-section__body">
              <label>
                ชื่อรายการ
                <input
                  required
                  autoFocus
                  value={name}
                  placeholder="เช่น หยกมงคล"
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label>
                <span className="create-item-label-row">
                  คำอธิบายสำหรับผู้เล่น
                  <small>ไม่บังคับ</small>
                </span>
                <textarea
                  rows="3"
                  value={description}
                  placeholder="บอกว่ารายการนี้คืออะไร ใช้ทำอะไร หรือมีเงื่อนไขใด"
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>

              <fieldset className="item-choice-fieldset">
                <legend>หลังผู้เล่นแลกสำเร็จ</legend>
                <div className="item-choice-grid">
                  <label className={fulfillmentType === "inventory" ? "selected" : ""}>
                    <input
                      type="radio"
                      name="fulfillmentType"
                      value="inventory"
                      checked={fulfillmentType === "inventory"}
                      onChange={(event) => setFulfillmentType(event.target.value)}
                    />
                    <span>
                      <strong>เก็บเป็นไอเท็ม</strong>
                      <small>เพิ่มเข้าคลังตัวละคร เพื่อนำไปใช้ภายหลัง</small>
                    </span>
                  </label>
                  <label className={fulfillmentType === "staff_request" ? "selected" : ""}>
                    <input
                      type="radio"
                      name="fulfillmentType"
                      value="staff_request"
                      checked={fulfillmentType === "staff_request"}
                      onChange={(event) => setFulfillmentType(event.target.value)}
                    />
                    <span>
                      <strong>เปิดเหตุการณ์พิเศษ</strong>
                      <small>หักแต้มแล้วส่งเข้าคิวให้สต๊าฟดำเนินเรื่อง</small>
                    </span>
                  </label>
                </div>
              </fieldset>
            </div>
          </fieldset>

          <AcquisitionFields
            value={acquisition}
            onChange={setAcquisition}
            sectionNumber="2"
            fulfillmentType={fulfillmentType}
          />

          <fieldset className="create-item-section">
            <div className="create-item-section__heading">
              <span className="create-item-section__number">3</span>
              <span>
                <strong>ราคาและจำนวน</strong>
                <small>กำหนดแต้มที่หักจริง และเลือกว่าจะควบคุมจำนวนคงเหลือหรือไม่</small>
              </span>
            </div>
            <div className="create-item-section__body">
              <div className="item-form-grid item-price-grid">
              <label>
                แต้มที่ใช้ต่อครั้ง
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={cost}
                  onChange={(event) => setCost(event.target.value)}
                />
              </label>
              <label>
                หักจาก
                <select
                  value={priceCurrency}
                  onChange={(event) => setPriceCurrency(event.target.value)}
                >
                  <option value="rp">แต้ม RP</option>
                  <option value="favor">แต้มโปรดปราน</option>
                </select>
              </label>
              </div>

              <div className="create-item-toggle-list single">
                <label className="stock-toggle">
                <input
                  type="checkbox"
                  checked={isLimited}
                  onChange={(event) => setIsLimited(event.target.checked)}
                />
                <span>
                  <strong>จำกัดจำนวนที่แลกได้</strong>
                  <small>เมื่อจำนวนเหลือศูนย์ ผู้เล่นจะกดแลกไม่ได้</small>
                </span>
                </label>
              </div>

              {isLimited && (
                <div className="item-number-grid create-item-stock-fields">
                <label>
                  จำนวนที่มี
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={stockQuantity}
                    onChange={(event) => setStockQuantity(event.target.value)}
                  />
                </label>
                <label>
                  แจ้งเตือนเมื่อเหลือ
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={lowStockThreshold}
                    onChange={(event) => setLowStockThreshold(event.target.value)}
                  />
                  <small>ทีมงานจะเห็นสถานะใกล้หมดเมื่อเหลือเท่ากับหรือต่ำกว่านี้</small>
                </label>
                </div>
              )}
            </div>
          </fieldset>

          {error && <p className="inventory-error create-item-error" role="alert">{error}</p>}

          <div className="modal-actions create-item-actions">
            <span>ตรวจสอบข้อมูลให้ครบก่อนเปิดให้ผู้เล่นแลก</span>
            <div>
              <button type="button" className="secondary-button" onClick={requestClose}>
                ยกเลิก
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={submitting || !name.trim()}
              >
                {submitting ? "กำลังบันทึก..." : "เพิ่มรายการ"}
              </button>
            </div>
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
  const [acquisition, setAcquisition] = useState({
    acquisitionType: item.acquisition_type || "palace_stock",
    catalogVisibility: item.catalog_visibility || "public",
    acquisitionRequiresRoll: Boolean(item.acquisition_requires_roll),
    acquisitionSuccessPercent: item.acquisition_success_percent || 70,
    minimumFavor: item.minimum_favor || 0,
    commandFavorThreshold: item.command_favor_threshold || 20,
    fulfillmentDaysMin: item.fulfillment_days_min || 0,
    fulfillmentDaysMax: item.fulfillment_days_max ?? 1,
    autoFulfill: item.auto_fulfill !== false,
    acquisitionChannelId: item.acquisition_channel_id || "",
    acquisitionRiskLevel: item.acquisition_risk_level || 1,
    failureConsequence: item.failure_consequence || "",
    criticalFailureConsequence: item.critical_failure_consequence || "",
  });
  const [tasks, setTasks] = useState(() =>
    normalizeTasks(item.action_template),
  );
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
      ...acquisition,
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

  async function handleDelete() {
    const confirmed = window.confirm(
      `ลบ "${item.name}" ออกจากทะเบียนสิ่งของถาวรใช่ไหม\nหากมีประวัติการใช้งาน ระบบจะไม่อนุญาตให้ลบ`,
    );
    if (!confirmed) return;

    setDeleting(true);
    setError("");
    const { error: deleteError } = await deleteCatalogItem(item.id);
    setDeleting(false);

    if (deleteError) {
      setError(
        deleteError.message?.includes("usage history")
          ? "ไอเท็มนี้มีประวัติการใช้งานแล้ว กรุณาปิดสถานะใช้งานแทนการลบ"
          : deleteError.message?.includes("delete_catalog_item")
            ? "กรุณารัน migration ระบบลบไอเท็มก่อน"
            : deleteError.message || "ลบไอเท็มไม่สำเร็จ",
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
              แต้มที่ใช้
              <input
                type="number"
                min="0"
                value={cost}
                onChange={(event) => setCost(event.target.value)}
              />
            </label>
            <label>
              ชำระด้วย
              <select
                value={priceCurrency}
                onChange={(event) => setPriceCurrency(event.target.value)}
              >
                <option value="rp">แต้ม RP</option>
                <option value="favor">แต้มโปรดปราน</option>
              </select>
            </label>
          </div>

          <label>
            เมื่อแลกสำเร็จ
            <select
              value={fulfillmentType}
              onChange={(event) => setFulfillmentType(event.target.value)}
            >
              <option value="inventory">รับเป็นไอเท็ม — เก็บไว้ในคลังผู้เล่น</option>
              <option value="staff_request">
                เปิดเหตุการณ์พิเศษ — ส่งงานให้สต๊าฟดำเนินเรื่อง
              </option>
            </select>
          </label>

          <AcquisitionFields value={acquisition} onChange={setAcquisition} />

          <label className="stock-toggle">
            <input
              type="checkbox"
              checked={shopAvailable}
              onChange={(event) => setShopAvailable(event.target.checked)}
            />
            <span>
              <strong>เปิดให้ผู้เล่นเห็นและเลือกรับ</strong>
              <small>
                ผู้เล่นจะเห็นรายการถูกกฎทั่วไปเมื่อเปิดตัวเลือกนี้และไอเท็มยังใช้งานอยู่
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
                <small>ทอยแบบหลังไมค์ โดยผู้ได้รับผลเป็นผู้ทอยตามที่แม่งานแจ้ง</small>
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
              className="danger-button item-delete-button"
              disabled={submitting || deleting}
              onClick={handleDelete}
            >
              <Trash2 size={15} />
              {deleting ? "กำลังลบ..." : "ลบไอเท็ม"}
            </button>
            <span className="modal-actions-spacer" />
            <button
              type="button"
              className="secondary-button"
              disabled={submitting || deleting}
              onClick={onClose}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={submitting || deleting || !name.trim()}
            >
              {submitting ? "กำลังบันทึก..." : "บันทึกรายละเอียด"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
