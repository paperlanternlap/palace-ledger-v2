import { useEffect, useState } from "react";
import { Link2, X } from "lucide-react";
import {
  createRpSubmission,
  getCharactersForSubmission,
} from "./rpQueueService";

const submissionTypes = [
  "โรลเพลย์",
  "เข้าร่วมกิจกรรม",
  "งานวาด / งานสร้างสรรค์",
  "ภารกิจ",
  "สำรวจ",
  "อื่น ๆ",
];

export function CreateSubmissionModal({ onClose, onCreated }) {
  const [characters, setCharacters] = useState([]);
  const [characterId, setCharacterId] = useState("");
  const [roleUrl, setRoleUrl] = useState("");
  const [submissionType, setSubmissionType] = useState("โรลเพลย์");
  const [participantNames, setParticipantNames] = useState("");
  const [playerNote, setPlayerNote] = useState("");
  const [loadingCharacters, setLoadingCharacters] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getCharactersForSubmission().then(({ data, error: characterError }) => {
      if (!active) return;
      setCharacters(data || []);
      setLoadingCharacters(false);
      if (characterError) setError("โหลดรายชื่อตัวละครไม่สำเร็จ");
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      const parsedUrl = new URL(roleUrl);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error();
    } catch {
      setError("กรุณาใส่ลิงก์ผลงานหรือหลักฐานที่ขึ้นต้นด้วย http:// หรือ https://");
      return;
    }

    setSubmitting(true);
    const { data, error: createError } = await createRpSubmission({
      characterId: Number(characterId),
      roleUrl: roleUrl.trim(),
      submissionType,
      participantNames: participantNames.trim(),
      playerNote: playerNote.trim(),
    });
    setSubmitting(false);

    if (createError) {
      setError(
        createError.code === "23505"
          ? "ลิงก์นี้ถูกส่งเข้าระบบแล้ว"
          : createError.message || "เพิ่มผลงานเข้าคิวไม่สำเร็จ",
      );
      return;
    }
    onCreated(data.id);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="submission-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-submission-title"
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

        <div className="submission-modal-icon">
          <Link2 size={20} />
        </div>
        <h2 id="create-submission-title">เพิ่มผลงานเข้าคิว</h2>
        <p>ใช้สำหรับบันทึกผลงานหรือหลักฐานการเข้าร่วมแทนผู้เล่น</p>

        <form onSubmit={handleSubmit}>
          <div className="submission-form-grid">
            <label>
              ตัวละคร
              <select
                required
                value={characterId}
                disabled={loadingCharacters}
                onChange={(event) => setCharacterId(event.target.value)}
              >
                <option value="">
                  {loadingCharacters ? "กำลังโหลด..." : "เลือกตัวละคร"}
                </option>
                {characters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.character_name} · {character.player_name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              ประเภทผลงาน
              <select
                value={submissionType}
                onChange={(event) => setSubmissionType(event.target.value)}
              >
                {submissionTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
          </div>

          <label>
            ลิงก์ผลงานหรือหลักฐาน
            <input
              type="url"
              required
              value={roleUrl}
              placeholder="https://..."
              onChange={(event) => setRoleUrl(event.target.value)}
            />
          </label>

          <label>
            ผู้ร่วมงาน
            <input
              value={participantNames}
              placeholder="ชื่อผู้ร่วมงานหรือผู้ร่วมกิจกรรม คั่นด้วยเครื่องหมายจุลภาค"
              onChange={(event) => setParticipantNames(event.target.value)}
            />
          </label>

          <label>
            หมายเหตุ
            <textarea
              rows="3"
              value={playerNote}
              placeholder="รายละเอียดเพิ่มเติมหรือข้อความที่ลูกมูฝากไว้..."
              onChange={(event) => setPlayerNote(event.target.value)}
            />
          </label>

          {error && <p className="review-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              ยกเลิก
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={submitting || loadingCharacters}
            >
              {submitting ? "กำลังเพิ่ม..." : "เพิ่มเข้าคิว"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
