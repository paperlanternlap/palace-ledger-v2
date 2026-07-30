import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, UserPlus, Users, X } from "lucide-react";
import {
  assignFollower,
  createFollowerWithTalents,
  getCharactersForFollowerAssignment,
  getExplorationLocations,
  updateFollowerWithTalents,
} from "./followerService";

const followerTypes = [
  { value: "close_maid", label: "นางกำนัลใกล้ชิด" },
  { value: "maid", label: "นางกำนัลทั่วไป" },
  { value: "eunuch", label: "ขันที" },
  { value: "kitchen", label: "คนจากห้องเครื่อง" },
  { value: "gardener", label: "คนสวน" },
  { value: "physician", label: "หมอ / ผู้ช่วยแพทย์" },
  { value: "guard", label: "ทหาร / องครักษ์" },
  { value: "merchant", label: "พ่อค้า" },
  { value: "tailor", label: "ช่างเย็บปัก" },
  { value: "scribe", label: "เสมียน" },
  { value: "courier", label: "คนส่งของ" },
  { value: "ritual_attendant", label: "ผู้ดูแลงานพิธี" },
  { value: "other", label: "อื่น ๆ" },
];

const talentOptions = [
  "สวน",
  "สมุนไพร",
  "ข่าว",
  "อาหาร",
  "ข่าวห้องเครื่อง",
  "ข่าววังหลัง",
  "ข่าวพระสนม",
  "การเมือง",
  "ติดตามคน",
  "การค้า",
  "เอกสาร",
  "การแพทย์",
  "ความลับ",
];

export function CreateFollowerModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: "",
    avatarUrl: "",
    followerType: "maid",
    description: "",
    accessAreas: [],
    cost: 0,
    weeklyMissionLimit: 2,
    talents: [
      { key: "ข่าว", label: "สืบข่าว", modifierPercent: 20 },
    ],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    let active = true;
    getExplorationLocations().then(({ data }) => {
      if (active) setLocations(data || []);
    });
    return () => {
      active = false;
    };
  }, []);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateTalent(index, key, value) {
    setForm((current) => ({
      ...current,
      talents: current.talents.map((talent, talentIndex) =>
        talentIndex === index ? { ...talent, [key]: value } : talent,
      ),
    }));
  }

  function addTalent() {
    setForm((current) => ({
      ...current,
      talents: [
        ...current.talents,
        { key: "สวน", label: "ความถนัด", modifierPercent: 10 },
      ],
    }));
  }

  function removeTalent(index) {
    setForm((current) => ({
      ...current,
      talents: current.talents.filter((_, talentIndex) => talentIndex !== index),
    }));
  }

  function toggleAccessArea(area) {
    setForm((current) => ({
      ...current,
      accessAreas: current.accessAreas.includes(area)
        ? current.accessAreas.filter((item) => item !== area)
        : [...current.accessAreas, area],
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const { data, error: createError } = await createFollowerWithTalents({
      ...form,
      name: form.name.trim(),
      avatarUrl: form.avatarUrl.trim(),
      description: form.description.trim(),
      accessAreas: form.accessAreas,
      cost: Number(form.cost) || 0,
      weeklyMissionLimit: Number(form.weeklyMissionLimit) || 0,
      talents: form.talents
        .map((talent) => ({
          key: talent.key.trim(),
          label: talent.label.trim() || talent.key.trim(),
          modifierPercent: Number(talent.modifierPercent) || 0,
        }))
        .filter((talent, index, talents) =>
          talent.key &&
          talents.findIndex((item) => item.key === talent.key) === index
        ),
    });
    setSubmitting(false);

    if (createError) {
      setError(
        createError.code === "23505"
          ? "มีผู้ติดตามชื่อนี้อยู่ในระบบแล้ว"
          : createError.message || "เพิ่มผู้ติดตามไม่สำเร็จ",
      );
      return;
    }
    onCreated(data.id);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="follower-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-follower-title"
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
        <div className="follower-modal-icon">
          <UserPlus size={21} />
        </div>
        <h2 id="create-follower-title">เพิ่มผู้ติดตามเข้าทะเบียน</h2>
        <p>ผู้ติดตามหนึ่งคนมีได้เพียงเจ้าของเดียว และเริ่มต้นโดยยังไม่มีเจ้าของ</p>

        <form onSubmit={submit}>
          <div className="follower-form-grid">
            <label>
              ชื่อผู้ติดตาม
              <input
                required
                value={form.name}
                placeholder="เช่น เสี่ยวหลัน"
                onChange={(event) => update("name", event.target.value)}
              />
            </label>
            <label>
              ประเภท
              <select
                value={form.followerType}
                onChange={(event) => update("followerType", event.target.value)}
              >
                {followerTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="follower-form-grid">
            <label>
              ราคาแต้ม
              <input
                type="number"
                min="0"
                value={form.cost}
                onChange={(event) => update("cost", event.target.value)}
              />
            </label>
            <label>
              รูปภาพ
              <input
                type="url"
                value={form.avatarUrl}
                placeholder="https://..."
                onChange={(event) => update("avatarUrl", event.target.value)}
              />
            </label>
          </div>

          <label>
            คำอธิบาย
            <textarea
              rows="2"
              value={form.description}
              placeholder="บุคลิก ภูมิหลัง หรือข้อมูลที่ผู้เล่นมองเห็น"
              onChange={(event) => update("description", event.target.value)}
            />
          </label>

          <fieldset className="follower-location-picker">
            <legend>พื้นที่ที่ส่งไปสำรวจได้</legend>
            <small>
              เลือกจากโลเคชั่นจริง ผู้เล่นจะเห็นเฉพาะพื้นที่ที่กำหนดไว้ตรงนี้
            </small>
            {locations.length ? (
              <div>
                {locations.map((location) => (
                  <label key={location.id}>
                    <input
                      type="checkbox"
                      checked={form.accessAreas.includes(location.short_name)}
                      onChange={() => toggleAccessArea(location.short_name)}
                    />
                    <span>
                      <b>เขต {location.zone_number}</b>
                      {location.short_name}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p>ยังไม่มีโลเคชั่นสำรวจที่เปิดใช้งาน</p>
            )}
          </fieldset>

          <fieldset className="follower-talent-editor">
            <div className="follower-talent-heading">
              <div>
                <strong>Talent สำหรับการสำรวจ</strong>
                <small>ค่าบวกช่วยเพิ่มโอกาส ค่าลบเป็นจุดอ่อน</small>
              </div>
              <button type="button" onClick={addTalent}>
                <Plus size={14} /> เพิ่ม Talent
              </button>
            </div>
            {form.talents.map((talent, index) => (
              <div className="follower-talent-row" key={`${index}-${talent.key}`}>
                <label>
                  หัวข้อ
                  <input
                    list="follower-talent-options"
                    value={talent.key}
                    onChange={(event) =>
                      updateTalent(index, "key", event.target.value)
                    }
                  />
                </label>
                <label>
                  ชื่อที่แสดง
                  <input
                    value={talent.label}
                    placeholder="เช่น ชำนาญสวน"
                    onChange={(event) =>
                      updateTalent(index, "label", event.target.value)
                    }
                  />
                </label>
                <label>
                  ผลต่อโอกาส
                  <div className="talent-percent-input">
                    <input
                      type="number"
                      min="-100"
                      max="100"
                      value={talent.modifierPercent}
                      onChange={(event) =>
                        updateTalent(index, "modifierPercent", event.target.value)
                      }
                    />
                    <span>%</span>
                  </div>
                </label>
                <button
                  type="button"
                  className="talent-remove"
                  aria-label="ลบ Talent"
                  onClick={() => removeTalent(index)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <datalist id="follower-talent-options">
              {talentOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </fieldset>

          <label>
            ส่งภารกิจได้ต่อสัปดาห์
            <input
              type="number"
              min="0"
              value={form.weeklyMissionLimit}
              onChange={(event) =>
                update("weeklyMissionLimit", event.target.value)
              }
            />
          </label>

          {error && <p className="follower-form-error">{error}</p>}

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
              disabled={submitting || !form.name.trim()}
            >
              {submitting ? "กำลังเพิ่ม..." : "เพิ่มเข้าทะเบียน"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function EditFollowerModal({ follower, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: follower.name || "",
    avatarUrl: follower.avatar_url || "",
    followerType: follower.follower_type || "maid",
    description: follower.description || "",
    accessAreas: follower.access_areas || [],
    cost: follower.cost || 0,
    weeklyMissionLimit: follower.weekly_mission_limit ?? 2,
    active: follower.active !== false,
    talents: (follower.talents || []).map((talent) => ({
      key: talent.talent_key || "",
      label: talent.label || talent.talent_key || "",
      modifierPercent: talent.modifier_percent || 0,
    })),
  });
  const [locations, setLocations] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getExplorationLocations().then(({ data }) => {
      if (active) setLocations(data || []);
    });
    return () => {
      active = false;
    };
  }, []);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleAccessArea(area) {
    setForm((current) => ({
      ...current,
      accessAreas: current.accessAreas.includes(area)
        ? current.accessAreas.filter((item) => item !== area)
        : [...current.accessAreas, area],
    }));
  }

  function updateTalent(index, key, value) {
    setForm((current) => ({
      ...current,
      talents: current.talents.map((talent, talentIndex) =>
        talentIndex === index ? { ...talent, [key]: value } : talent,
      ),
    }));
  }

  function addTalent() {
    setForm((current) => ({
      ...current,
      talents: [
        ...current.talents,
        { key: "ข่าว", label: "ความถนัด", modifierPercent: 10 },
      ],
    }));
  }

  function removeTalent(index) {
    setForm((current) => ({
      ...current,
      talents: current.talents.filter((_, talentIndex) => talentIndex !== index),
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const cleanTalents = form.talents
      .map((talent) => ({
        key: talent.key.trim(),
        label: talent.label.trim() || talent.key.trim(),
        modifierPercent: Number(talent.modifierPercent) || 0,
      }))
      .filter(
        (talent, index, talents) =>
          talent.key &&
          talents.findIndex((item) => item.key === talent.key) === index,
      );
    const { error: updateError } = await updateFollowerWithTalents(
      follower.id,
      {
        ...form,
        name: form.name.trim(),
        avatarUrl: form.avatarUrl.trim(),
        description: form.description.trim(),
        cost: Number(form.cost) || 0,
        weeklyMissionLimit: Number(form.weeklyMissionLimit) || 0,
        talents: cleanTalents,
      },
    );
    setSubmitting(false);

    if (updateError) {
      setError(
        updateError.code === "23505"
          ? "ชื่อหรือ Talent ซ้ำกับข้อมูลที่มีอยู่"
          : updateError.message?.includes("update_follower_with_talents")
            ? "กรุณารัน migration ระบบแก้ไขผู้ติดตามก่อน"
            : updateError.message || "บันทึกผู้ติดตามไม่สำเร็จ",
      );
      return;
    }
    onSaved(follower.id);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="follower-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-follower-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={onClose}>
          <X size={20} />
        </button>
        <div className="follower-modal-icon">
          <Pencil size={20} />
        </div>
        <h2 id="edit-follower-title">แก้ไขผู้ติดตาม · {follower.name}</h2>
        <p>ปรับข้อมูล ความถนัด พื้นที่สำรวจ และโควตาการใช้งาน</p>

        <form onSubmit={submit}>
          <div className="follower-form-grid">
            <label>
              ชื่อผู้ติดตาม
              <input
                required
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
              />
            </label>
            <label>
              ประเภท
              <select
                value={form.followerType}
                onChange={(event) => update("followerType", event.target.value)}
              >
                {followerTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="follower-form-grid">
            <label>
              ราคาแต้ม
              <input
                type="number"
                min="0"
                value={form.cost}
                onChange={(event) => update("cost", event.target.value)}
              />
            </label>
            <label>
              ภารกิจต่อสัปดาห์
              <input
                type="number"
                min="0"
                value={form.weeklyMissionLimit}
                onChange={(event) =>
                  update("weeklyMissionLimit", event.target.value)
                }
              />
            </label>
          </div>

          <label>
            รูปภาพ
            <input
              type="url"
              value={form.avatarUrl}
              placeholder="https://..."
              onChange={(event) => update("avatarUrl", event.target.value)}
            />
          </label>

          <label>
            คำอธิบาย
            <textarea
              rows="2"
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
            />
          </label>

          <fieldset className="follower-location-picker">
            <legend>พื้นที่ที่ส่งไปสำรวจได้</legend>
            <small>เลือกได้หลายพื้นที่จากโลเคชั่นที่เปิดใช้งาน</small>
            <div>
              {locations.map((location) => (
                <label key={location.id}>
                  <input
                    type="checkbox"
                    checked={form.accessAreas.includes(location.short_name)}
                    onChange={() => toggleAccessArea(location.short_name)}
                  />
                  <span>
                    <b>เขต {location.zone_number}</b>
                    {location.short_name}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="follower-talent-editor">
            <div className="follower-talent-heading">
              <div>
                <strong>Talent สำหรับสำรวจ</strong>
                <small>เปอร์เซ็นต์บวกหรือลบเมื่อ tag ตรงกับพื้นที่</small>
              </div>
              <button type="button" onClick={addTalent}>
                <Plus size={13} /> เพิ่ม Talent
              </button>
            </div>
            {form.talents.map((talent, index) => (
              <div className="follower-talent-row" key={`${index}-${talent.key}`}>
                <label>
                  Tag
                  <input
                    list="edit-follower-talent-options"
                    value={talent.key}
                    onChange={(event) =>
                      updateTalent(index, "key", event.target.value)
                    }
                  />
                </label>
                <label>
                  ชื่อที่แสดง
                  <input
                    value={talent.label}
                    onChange={(event) =>
                      updateTalent(index, "label", event.target.value)
                    }
                  />
                </label>
                <label>
                  ผลต่อโอกาส
                  <div className="talent-percent-input">
                    <input
                      type="number"
                      min="-100"
                      max="100"
                      value={talent.modifierPercent}
                      onChange={(event) =>
                        updateTalent(index, "modifierPercent", event.target.value)
                      }
                    />
                    <span>%</span>
                  </div>
                </label>
                <button
                  type="button"
                  className="talent-remove"
                  aria-label="ลบ Talent"
                  onClick={() => removeTalent(index)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <datalist id="edit-follower-talent-options">
              {talentOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </fieldset>

          <label className="stock-toggle">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => update("active", event.target.checked)}
            />
            <span>
              <strong>เปิดให้ใช้งาน</strong>
              <small>ปิดเพื่อซ่อนผู้ติดตามโดยไม่ลบประวัติ</small>
            </span>
          </label>

          {error && <p className="follower-form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              ยกเลิก
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={submitting || !form.name.trim()}
            >
              {submitting ? "กำลังบันทึก..." : "บันทึกผู้ติดตาม"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function AssignFollowerModal({
  follower,
  onClose,
  onAssigned,
}) {
  const [characters, setCharacters] = useState([]);
  const [characterId, setCharacterId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getCharactersForFollowerAssignment().then(({ data, error: loadError }) => {
      if (!active) return;
      setCharacters(data || []);
      if (loadError) setError("โหลดรายชื่อตัวละครไม่สำเร็จ");
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const { error: assignError } = await assignFollower(
      follower.id,
      Number(characterId),
    );
    setSubmitting(false);
    if (assignError) {
      setError(
        assignError.message?.includes("already has an owner")
          ? "ผู้ติดตามคนนี้มีเจ้าของแล้ว กรุณาโหลดข้อมูลใหม่"
          : assignError.message || "มอบผู้ติดตามไม่สำเร็จ",
      );
      return;
    }
    onAssigned();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-card assign-follower-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-follower-title"
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
        <div className="follower-modal-icon">
          <Users size={21} />
        </div>
        <h2 id="assign-follower-title">มอบ {follower.name}</h2>
        <p className="modal-description">
          เมื่อยืนยัน ผู้ติดตามคนนี้จะไม่แสดงในรายการพร้อมรับสมัครอีก
        </p>

        <form onSubmit={submit}>
          <label>
            ตัวละครเจ้าของ
            <select
              required
              autoFocus
              disabled={loading}
              value={characterId}
              onChange={(event) => setCharacterId(event.target.value)}
            >
              <option value="">
                {loading ? "กำลังโหลดรายชื่อ..." : "เลือกตัวละคร"}
              </option>
              {characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.character_name} · {character.player_name}
                </option>
              ))}
            </select>
          </label>

          {error && <p className="follower-form-error">{error}</p>}

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
              disabled={loading || submitting || !characterId}
            >
              {submitting ? "กำลังมอบ..." : "ยืนยันมอบผู้ติดตาม"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
