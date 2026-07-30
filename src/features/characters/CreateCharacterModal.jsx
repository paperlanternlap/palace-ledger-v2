import { useState } from "react";
import { UserPlus, X } from "lucide-react";
import { createCharacter } from "./characterService";
import {
  CHARACTER_ROLE_OPTIONS,
  POSITION_OPTIONS_BY_ROLE,
} from "./rankOptions";

export function CreateCharacterModal({ onClose, onCreated }) {
  const [values, setValues] = useState({
    characterName: "",
    playerName: "",
    username: "",
    position: "",
    palace: "",
    role: "",
    avatarUrl: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const result = await createCharacter(values);
    setSubmitting(false);

    if (result.error) {
      setError(
        result.error.code === "23505"
          ? "ชื่อผู้ใช้นี้ถูกใช้แล้ว"
          : result.error.message || "เพิ่มตัวละครไม่สำเร็จ",
      );
      return;
    }

    onCreated(result.data);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-card create-character-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-character-title"
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

        <div className="create-character-icon">
          <UserPlus size={20} />
        </div>
        <span className="eyebrow">เพิ่มเข้าทะเบียน</span>
        <h2 id="create-character-title">เพิ่มตัวละคร</h2>
        <p className="modal-description">
          ตัวละครใหม่จะเข้าใช้งานได้ทันทีด้วยชื่อผู้ใช้ที่กำหนด
        </p>

        <form onSubmit={handleSubmit}>
          <div className="create-character-grid">
            <label>
              ชื่อตัวละคร
              <input
                required
                autoFocus
                value={values.characterName}
                onChange={(event) => update("characterName", event.target.value)}
              />
            </label>
            <label>
              ชื่อผู้เล่น
              <input
                required
                value={values.playerName}
                onChange={(event) => update("playerName", event.target.value)}
              />
            </label>
            <label className="full">
              Username สำหรับเข้าระบบ
              <input
                required
                value={values.username}
                placeholder="ใช้ตัวอักษรหรือตัวเลขที่จำง่าย"
                onChange={(event) => update("username", event.target.value)}
              />
            </label>
            <label className="full">
              ประเภทตัวละคร
              <select
                value={values.role}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    role: event.target.value,
                    position: "",
                  }))
                }
              >
                <option value="">ยังไม่ระบุ</option>
                {CHARACTER_ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </label>
            <label>
              ตำแหน่ง
              <select
                value={values.position}
                onChange={(event) => update("position", event.target.value)}
              >
                <option value="">เลือกตำแหน่ง</option>
                {values.role && POSITION_OPTIONS_BY_ROLE[values.role] ? (
                  POSITION_OPTIONS_BY_ROLE[values.role].map((position) => (
                    <option key={position} value={position}>{position}</option>
                  ))
                ) : (
                  Object.entries(POSITION_OPTIONS_BY_ROLE).map(([role, positions]) => (
                    <optgroup key={role} label={role}>
                      {positions.map((position) => (
                        <option key={position} value={position}>{position}</option>
                      ))}
                    </optgroup>
                  ))
                )}
              </select>
            </label>
            <label>
              ตำหนัก
              <input
                value={values.palace}
                placeholder="ถ้ามี"
                onChange={(event) => update("palace", event.target.value)}
              />
            </label>
            <label className="full">
              URL รูปตัวละคร
              <input
                type="url"
                value={values.avatarUrl}
                placeholder="https://..."
                onChange={(event) => update("avatarUrl", event.target.value)}
              />
            </label>
          </div>

          {error && <p className="create-character-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              ยกเลิก
            </button>
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? "กำลังเพิ่ม..." : "เพิ่มตัวละคร"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
