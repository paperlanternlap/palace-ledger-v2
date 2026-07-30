import { useEffect, useState } from "react";
import { Plus, Trash2, UserPlus, Users, X } from "lucide-react";
import {
  assignFollower,
  createFollowerWithTalents,
  getCharactersForFollowerAssignment,
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

function splitTags(value) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function CreateFollowerModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: "",
    avatarUrl: "",
    followerType: "maid",
    description: "",
    accessAreas: "",
    cost: 0,
    weeklyMissionLimit: 1,
    talents: [
      { key: "ข่าว", label: "สืบข่าว", modifierPercent: 20 },
    ],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const { data, error: createError } = await createFollowerWithTalents({
      ...form,
      name: form.name.trim(),
      avatarUrl: form.avatarUrl.trim(),
      description: form.description.trim(),
      accessAreas: splitTags(form.accessAreas),
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

          <label>
            พื้นที่เข้าถึง
            <input
              value={form.accessAreas}
              placeholder="กองโอสถ, ห้องเครื่อง"
              onChange={(event) => update("accessAreas", event.target.value)}
            />
            <small>คั่นแต่ละรายการด้วยเครื่องหมายจุลภาค</small>
          </label>

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
