import { useEffect, useMemo, useState } from "react";
import { UserRoundCheck, X } from "lucide-react";
import {
  addCharacterNpcAcquaintance,
  getNpcAcquisitionChannels,
} from "./characterService";

export function NpcAcquaintanceModal({ character, acquaintances, onClose, onSaved }) {
  const [channels, setChannels] = useState([]);
  const [channelId, setChannelId] = useState("");
  const [source, setSource] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getNpcAcquisitionChannels().then(({ data, error: loadError }) => {
      if (!active) return;
      if (loadError) setError("โหลดรายชื่อ NPC ไม่สำเร็จ");
      else setChannels(data || []);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const knownIds = useMemo(
    () => new Set(acquaintances.map((entry) => entry.acquisition_channel?.id)),
    [acquaintances],
  );
  const availableChannels = channels.filter((channel) => !knownIds.has(channel.id));
  const selectedChannel = channels.find((channel) => String(channel.id) === channelId);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const { error: saveError } = await addCharacterNpcAcquaintance({
      characterId: character.id,
      acquisitionChannelId: Number(channelId),
      source: source.trim(),
      note: note.trim(),
    });
    setSubmitting(false);
    if (saveError) {
      setError(saveError.message || "บันทึกการรู้จัก NPC ไม่สำเร็จ");
      return;
    }
    onSaved();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="item-modal compact npc-acquaintance-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="npc-acquaintance-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal-close" aria-label="ปิด" onClick={onClose}>
          <X size={20} />
        </button>
        <div className="item-modal-icon"><UserRoundCheck size={21} /></div>
        <h2 id="npc-acquaintance-title">เพิ่ม NPC ที่รู้จัก</h2>
        <p>
          บันทึกความสัมพันธ์ของ {character.character_name} เมื่อเพิ่มแล้ว ผู้เล่นจะเห็นสิ่งของทุกชิ้นที่ NPC คนนั้นจัดหาได้
        </p>

        <form onSubmit={submit}>
          <label>
            NPC
            <select
              required
              disabled={loading || !availableChannels.length}
              value={channelId}
              onChange={(event) => setChannelId(event.target.value)}
            >
              <option value="">
                {loading
                  ? "กำลังโหลดรายชื่อ..."
                  : availableChannels.length ? "เลือก NPC" : "รู้จัก NPC ครบทุกคนแล้ว"}
              </option>
              {availableChannels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.npc_name} · {channel.npc_role}
                </option>
              ))}
            </select>
          </label>

          {selectedChannel && (
            <div className="npc-acquaintance-preview">
              <strong>{selectedChannel.npc_name}</strong>
              <span>{selectedChannel.npc_role}</span>
              <p>{selectedChannel.access_reason}</p>
              <small>แนวทางทำความรู้จัก: {selectedChannel.unlock_method}</small>
            </div>
          )}

          <label>
            รู้จักกันจากที่ใด
            <input
              required
              value={source}
              placeholder="เช่น พบกันในอีเวนต์เรือนยา"
              onChange={(event) => setSource(event.target.value)}
            />
          </label>
          <label>
            หมายเหตุแม่งาน
            <textarea rows="2" value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          {error && <p className="inventory-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>ยกเลิก</button>
            <button
              type="submit"
              className="primary-button"
              disabled={submitting || !channelId || !source.trim()}
            >
              {submitting ? "กำลังบันทึก..." : "ยืนยันว่ารู้จัก NPC"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
