import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Compass, Package, XCircle } from "lucide-react";
import {
  cancelFollowerExploration,
  getFollowerExplorations,
  getFollowerRewardItems,
  resolveFollowerExploration,
} from "./followerService";

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function missionLocationName(mission) {
  return mission.location?.short_name || mission.destination;
}

export function FollowerMissionQueue({ onMissionChanged }) {
  const [missions, setMissions] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [rewardItemId, setRewardItemId] = useState("");
  const [rewardQuantity, setRewardQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadMissions(preferredId) {
    setLoading(true);
    const [missionResult, itemResult] = await Promise.all([
      getFollowerExplorations(),
      getFollowerRewardItems(),
    ]);
    if (missionResult.error) {
      setMissions([]);
      setError(
        missionResult.error.message?.includes("follower_explorations")
          ? "รัน migration ภารกิจผู้ติดตามก่อนใช้งาน"
          : "โหลดภารกิจไม่สำเร็จ",
      );
    } else {
      setMissions(missionResult.data || []);
      setSelectedId((current) => {
        const targetId = preferredId || current;
        return (missionResult.data || []).some(
          (mission) => mission.id === targetId,
        )
          ? targetId
          : missionResult.data?.[0]?.id || null;
      });
      setError("");
    }
    if (!itemResult.error) setItems(itemResult.data || []);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(loadMissions, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const selected = useMemo(
    () => missions.find((mission) => mission.id === selectedId) || null,
    [missions, selectedId],
  );
  const activeCount = missions.filter(
    (mission) => mission.status === "exploring",
  ).length;

  function selectMission(mission) {
    setSelectedId(mission.id);
    setSummary("");
    setDetails("");
    setRewardItemId("");
    setRewardQuantity(1);
    setError("");
  }

  async function handleResolve(event) {
    event.preventDefault();
    if (!selected || !summary.trim()) return;
    setBusy(true);
    setError("");
    const result = await resolveFollowerExploration({
      missionId: selected.id,
      resultSummary: summary.trim(),
      resultDetails: details.trim(),
      rewardItemId: rewardItemId ? Number(rewardItemId) : null,
      rewardQuantity: Number(rewardQuantity) || 1,
    });
    setBusy(false);
    if (result.error) {
      setError(
        result.error.message?.includes("Insufficient reward stock")
          ? "สต็อกรางวัลไม่เพียงพอ"
          : result.error.message || "บันทึกผลไม่สำเร็จ",
      );
      return;
    }
    setSummary("");
    setDetails("");
    setRewardItemId("");
    await loadMissions();
    await onMissionChanged?.();
  }

  async function handleCancel() {
    if (!selected) return;
    const reason = window.prompt("เหตุผลที่ยกเลิกภารกิจ", "ยกเลิกภารกิจ");
    if (reason === null) return;
    setBusy(true);
    const result = await cancelFollowerExploration(selected.id, reason);
    setBusy(false);
    if (result.error) {
      setError(result.error.message || "ยกเลิกภารกิจไม่สำเร็จ");
      return;
    }
    await loadMissions();
    await onMissionChanged?.();
  }

  return (
    <div className="mission-workspace">
      <aside className="mission-directory">
        <header>
          <div>
            <span>กำลังรอผล</span>
            <strong>{activeCount}</strong>
          </div>
          <small>{missions.length} ภารกิจทั้งหมด</small>
        </header>
        <div className="mission-list">
          {loading ? (
            <p>กำลังโหลดภารกิจ...</p>
          ) : missions.length ? (
            missions.map((mission) => (
              <button
                type="button"
                key={mission.id}
                className={selectedId === mission.id ? "selected" : ""}
                onClick={() => selectMission(mission)}
              >
                <Compass size={17} />
                <span>
                  <strong>{mission.follower?.name || "ผู้ติดตาม"}</strong>
                  <small>
                    {missionLocationName(mission)} · {mission.character?.character_name}
                  </small>
                </span>
                <em className={mission.status}>{mission.status === "exploring" ? "รอผล" : mission.status === "completed" ? "เสร็จแล้ว" : "ยกเลิก"}</em>
              </button>
            ))
          ) : (
            <div className="mission-empty">
              <CheckCircle2 size={25} />
              <strong>ไม่มีภารกิจรอผล</strong>
              <span>เมื่อลูกมูส่งผู้ติดตาม รายการจะขึ้นที่นี่</span>
            </div>
          )}
        </div>
      </aside>

      <section className="mission-resolution">
        {!selected ? (
          <div className="mission-empty">
            <Compass size={28} />
            <strong>เลือกภารกิจเพื่อดูรายละเอียด</strong>
          </div>
        ) : (
          <>
            <header>
              <div>
                <span className={`mission-status ${selected.status}`}>
                  {selected.status === "exploring" ? "กำลังสำรวจ" : selected.status === "completed" ? "สรุปผลแล้ว" : "ยกเลิก"}
                </span>
                <h2>{selected.follower?.name} → {missionLocationName(selected)}</h2>
                <p>{selected.objective || "สำรวจและรวบรวมข้อมูลทั่วไป"}</p>
                <div className="mission-location-meta">
                  {selected.location?.category && (
                    <span>{selected.location.category}</span>
                  )}
                  <span
                    className={
                      selected.suitability_percent > 0
                        ? "positive"
                        : selected.suitability_percent < 0
                          ? "negative"
                          : ""
                    }
                  >
                    ความเหมาะสม{" "}
                    {selected.suitability_percent > 0 ? "+" : ""}
                    {selected.suitability_percent || 0}%
                  </span>
                </div>
              </div>
              <div>
                <span>เจ้าของ</span>
                <strong>{selected.character?.character_name}</strong>
                <small>{formatDate(selected.started_at)}</small>
              </div>
            </header>

            {selected.status === "exploring" ? (
              <form onSubmit={handleResolve}>
                <label>
                  สรุปผลสำหรับกิจกรรมล่าสุด
                  <input
                    required
                    value={summary}
                    placeholder="เช่น พบเบาะแสงานเลี้ยงลับในอุทยาน"
                    onChange={(event) => setSummary(event.target.value)}
                  />
                </label>
                <label>
                  รายละเอียดสำหรับสต๊าฟ
                  <textarea
                    rows="3"
                    value={details}
                    placeholder="ข้อมูลเพิ่มเติม เงื่อนไข หรือผลที่ควรจำ..."
                    onChange={(event) => setDetails(event.target.value)}
                  />
                </label>
                <div className="mission-reward-grid">
                  <label>
                    <Package size={14} /> รางวัลไอเท็ม
                    <select
                      value={rewardItemId}
                      onChange={(event) => setRewardItemId(event.target.value)}
                    >
                      <option value="">ไม่ได้รับไอเท็ม</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                          {item.is_limited ? ` (เหลือ ${item.stock_quantity})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    จำนวน
                    <input
                      type="number"
                      min="1"
                      disabled={!rewardItemId}
                      value={rewardQuantity}
                      onChange={(event) => setRewardQuantity(event.target.value)}
                    />
                  </label>
                </div>
                {error && <p className="follower-form-error">{error}</p>}
                <div className="mission-actions">
                  <button type="button" disabled={busy} onClick={handleCancel}>
                    <XCircle size={15} /> ยกเลิกภารกิจ
                  </button>
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={busy || !summary.trim()}
                  >
                    <CheckCircle2 size={15} /> บันทึกผลและส่งผู้ติดตามกลับ
                  </button>
                </div>
              </form>
            ) : (
              <div className="mission-result">
                <strong>{selected.result_summary}</strong>
                {selected.result_details && <p>{selected.result_details}</p>}
                {selected.reward?.name && (
                  <span>ได้รับ {selected.reward.name} ×{selected.reward_quantity}</span>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
