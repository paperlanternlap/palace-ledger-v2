import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Compass, Package, Sparkles, XCircle } from "lucide-react";
import { ListPagination } from "../../components/ui/ListPagination";
import { useListPagination } from "../../components/ui/useListPagination";
import {
  cancelFollowerExploration,
  getFollowerExplorations,
  getFollowerRewardItems,
  getExplorationLocationNotes,
  resolveFollowerExploration,
} from "./followerService";

const outcomeLabels = {
  critical_success: "สำเร็จอย่างยอดเยี่ยม",
  success: "สำเร็จ",
  failure: "ไม่สำเร็จ",
  critical_failure: "ล้มเหลวรุนแรง",
};

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
  const [statusFilter, setStatusFilter] = useState("exploring");
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [rewardItemId, setRewardItemId] = useState("");
  const [rewardQuantity, setRewardQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [itemError, setItemError] = useState("");
  const [locationNotes, setLocationNotes] = useState({});
  const [noteError, setNoteError] = useState("");

  async function loadMissions(preferredId) {
    setLoading(true);
    const [missionResult, itemResult, noteResult] = await Promise.all([
      getFollowerExplorations(),
      getFollowerRewardItems(),
      getExplorationLocationNotes(),
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
    if (itemResult.error) {
      setItems([]);
      setItemError("โหลดคลังไอเท็มไม่สำเร็จ กรุณาตรวจสิทธิ์หรือลองใหม่");
    } else {
      setItems(itemResult.data || []);
      setItemError(
        itemResult.data?.length
          ? ""
          : "ยังไม่มีไอเท็มที่เปิดใช้งานในคลัง",
      );
    }
    if (noteResult.error) {
      setLocationNotes({});
      setNoteError("โหลดโน้ตพื้นที่ไม่สำเร็จ กรุณาตรวจว่าติดตั้ง SQL ช่องโน้ตแอดมินแล้ว");
    } else {
      setLocationNotes(Object.fromEntries((noteResult.data || []).map((entry) => [String(entry.location_id), entry.note])));
      setNoteError("");
    }
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(loadMissions, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const statusCounts = useMemo(
    () => ({
      all: missions.length,
      exploring: missions.filter((mission) => mission.status === "exploring").length,
      completed: missions.filter((mission) => mission.status === "completed").length,
      cancelled: missions.filter((mission) => mission.status === "cancelled").length,
    }),
    [missions],
  );
  const filteredMissions = useMemo(
    () =>
      statusFilter === "all"
        ? missions
        : missions.filter((mission) => mission.status === statusFilter),
    [missions, statusFilter],
  );
  const missionPages = useListPagination(
    filteredMissions,
    8,
    statusFilter,
  );
  const selected = useMemo(
    () =>
      missionPages.pageItems.find((mission) => mission.id === selectedId) ||
      missionPages.pageItems[0] ||
      null,
    [missionPages.pageItems, selectedId],
  );
  const hasRolled = Boolean(selected?.resolution_outcome);
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
        <label className="mission-status-filter">
          <span>สถานะภารกิจ</span>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setSelectedId(null);
            }}
          >
            {[
              ["exploring", "รอตอบ"],
              ["completed", "สรุปแล้ว"],
              ["cancelled", "ยกเลิก"],
              ["all", "ทั้งหมด"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label} ({statusCounts[value]})
              </option>
            ))}
          </select>
        </label>
        <div className="mission-list">
          {loading ? (
            <p>กำลังโหลดภารกิจ...</p>
          ) : filteredMissions.length ? (
            missionPages.pageItems.map((mission) => (
              <button
                type="button"
                key={mission.id}
                className={selected?.id === mission.id ? "selected" : ""}
                onClick={() => selectMission(mission)}
              >
                <Compass size={17} />
                <span>
                  <strong>{mission.follower?.name || "ไปด้วยตัวเอง"}</strong>
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
              <strong>ไม่มีรายการในสถานะนี้</strong>
              <span>
                {statusFilter === "exploring"
                  ? "เมื่อผู้เล่นส่งผู้ติดตามสำรวจ งานที่รอตอบจะขึ้นที่นี่"
                  : "ลองเลือกดูสถานะอื่น"}
              </span>
            </div>
          )}
        </div>
        <ListPagination
          currentPage={missionPages.currentPage}
          totalPages={missionPages.totalPages}
          onPageChange={missionPages.setPage}
          label="หน้ารายการภารกิจสำรวจ"
        />
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
                <h2>{selected.follower?.name || "ไปด้วยตัวเอง"} → {missionLocationName(selected)}</h2>
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
                <div
                  className={`mission-roll-card ${
                    selected.resolution_outcome || "pending"
                  }`}
                >
                  <div>
                    <span>โอกาสสำเร็จ</span>
                    <strong>{selected.success_chance_percent ?? 60}%</strong>
                    <small>ฐาน {selected.location?.base_success_percent ?? 60}% · Talent {selected.suitability_percent > 0 ? "+" : ""}{selected.suitability_percent || 0}% ของฐาน</small>
                  </div>
                  {hasRolled ? (
                    <div className="mission-roll-result">
                      <span>{selected.roll_origin === 'player' ? 'ผลที่ผู้เล่นส่งมา' : 'ผลการสุ่มเดิม'}</span>
                      <strong>{outcomeLabels[selected.resolution_outcome]}</strong>
                      {selected.resolution_roll != null ? <details>
                        <summary>รายละเอียดการสุ่ม</summary>
                        <small>
                          สุ่มได้ {selected.resolution_roll} จาก 100 · สำเร็จเมื่อได้ 1–{selected.success_chance_percent}
                        </small>
                      </details> : <small>ระบบสุ่มตามโอกาสสำเร็จตอนผู้เล่นกดสำรวจ</small>}
                      {['success', 'critical_success'].includes(selected.resolution_outcome) && (selected.drop_roll != null
                        ? <span className="mission-drop-number">เลขไอเท็ม d100 <b>{selected.drop_roll}</b></span>
                        : <small>ยังไม่มีเลข d100 · ให้ติดตั้ง SQL อัปเดตระบบสำรวจ</small>)}
                    </div>
                  ) : (
                    <span className="mission-roll-hint">งานเดิมยังไม่มีผลสุ่ม · ให้ติดตั้ง SQL อัปเดตระบบสำรวจ</span>
                  )}
                </div>

                {selected.location_id && (locationNotes[String(selected.location_id)] || noteError) && (
                  <aside className="mission-location-note">
                    <strong>โน้ตสถานที่สำหรับสต๊าฟ</strong>
                    <p>{locationNotes[String(selected.location_id)] || noteError}</p>
                  </aside>
                )}

                {error && <p className="mission-roll-error">{error}</p>}

                {hasRolled && (
                <div className="mission-resolution-fields">
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
                    <span className="mission-field-title">
                      <Package size={14} /> รางวัลไอเท็ม
                    </span>
                    <small>
                      {items.length
                        ? `เลือกได้ ${items.length} รายการ`
                        : itemError}
                    </small>
                    <select
                      value={rewardItemId}
                      disabled={!items.length || (selected.request_id && !['success', 'critical_success'].includes(selected.resolution_outcome))}
                      onChange={(event) => setRewardItemId(event.target.value)}
                    >
                      <option value="">
                        {items.length
                          ? "ไม่ได้รับไอเท็ม"
                          : "ไม่มีไอเท็มให้เลือก"}
                      </option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                          {item.is_limited ? ` (เหลือ ${item.stock_quantity})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="mission-field-title">จำนวน</span>
                    <small>
                      {rewardItemId ? "จำนวนที่มอบให้ตัวละคร" : "เลือกไอเท็มก่อน"}
                    </small>
                    <input
                      type="number"
                      min="1"
                      max={selected.request_id ? 1 : undefined}
                      disabled={!rewardItemId}
                      value={rewardQuantity}
                      onChange={(event) => setRewardQuantity(event.target.value)}
                    />
                  </label>
                </div>
                </div>
                )}
                <div className="mission-actions">
                  <button type="button" disabled={busy} onClick={handleCancel}>
                    <XCircle size={15} /> ยกเลิกภารกิจ
                  </button>
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={busy || !hasRolled || !summary.trim() ||
                      (selected.roll_origin === 'player' && ['success', 'critical_success'].includes(selected.resolution_outcome) && selected.drop_roll == null)}
                  >
                    <CheckCircle2 size={15} /> บันทึกผลและมอบรางวัล
                  </button>
                </div>
              </form>
            ) : (
              <div className="mission-result">
                {hasRolled && (
                  <div className={`mission-result-roll ${selected.resolution_outcome}`}>
                    <Sparkles size={16} />
                    <span>
                      ผลสำรวจ · โอกาสสำเร็จ {selected.success_chance_percent}%
                    </span>
                    <strong>{outcomeLabels[selected.resolution_outcome]}</strong>
                  </div>
                )}
                {selected.drop_roll != null && <span>เลขไอเท็ม d100 ที่ผู้เล่นสุ่มได้: <strong>{selected.drop_roll}</strong></span>}
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
