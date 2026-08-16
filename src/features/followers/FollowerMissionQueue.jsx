import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Compass, Package, Sparkles, XCircle } from "lucide-react";
import { ListPagination } from "../../components/ui/ListPagination";
import { useListPagination } from "../../components/ui/useListPagination";
import {
  cancelFollowerExploration,
  getFollowerExplorations,
  getFollowerRewardItems,
  resolveFollowerExploration,
  rollFollowerExploration,
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
  const hasRolled =
    selected?.resolution_roll != null &&
    Boolean(selected?.resolution_outcome);
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

  async function handleRoll() {
    if (!selected || selected.resolution_roll) return;
    const confirmed = window.confirm(
      `สุ่มผลภารกิจที่โอกาสสำเร็จ ${selected.success_chance_percent}% ใช่ไหม\nผลจะถูกบันทึกและสุ่มซ้ำไม่ได้`,
    );
    if (!confirmed) return;

    setBusy(true);
    setError("");
    const result = await rollFollowerExploration(selected.id);
    setBusy(false);
    if (result.error) {
      const missingRollMigration =
        result.error.code === "PGRST202" ||
        result.error.message?.includes("roll_follower_exploration") ||
        result.error.message?.includes("schema cache");
      setError(
        missingRollMigration
          ? "ยังไม่ได้ติดตั้งระบบสุ่มผลบน Supabase กรุณารัน migration 20260731000000_add_follower_mission_rolls.sql"
          : result.error.message?.includes("already been rolled")
            ? "ภารกิจนี้สุ่มผลไปแล้ว"
            : result.error.message || "สุ่มผลไม่สำเร็จ",
      );
      await loadMissions(selected.id);
      return;
    }
    await loadMissions(selected.id);
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
                <div
                  className={`mission-roll-card ${
                    selected.resolution_outcome || "pending"
                  }`}
                >
                  <div>
                    <span>โอกาสสำเร็จ</span>
                    <strong>{selected.success_chance_percent ?? 60}%</strong>
                    <small>
                      พื้นฐาน 60% · Talent{" "}
                      {selected.suitability_percent > 0 ? "+" : ""}
                      {selected.suitability_percent || 0}%
                    </small>
                  </div>
                  {hasRolled ? (
                    <div className="mission-roll-result">
                      <span>ผลการสุ่ม</span>
                      <strong>{outcomeLabels[selected.resolution_outcome]}</strong>
                      <details>
                        <summary>รายละเอียดการสุ่ม</summary>
                        <small>
                          หมายเลขตรวจสอบ {selected.resolution_roll} · โอกาสสำเร็จ{" "}
                          {selected.success_chance_percent}%
                        </small>
                      </details>
                    </div>
                  ) : (
                    <button type="button" disabled={busy} onClick={handleRoll}>
                      <Sparkles size={17} />
                      สุ่มผลภารกิจ
                    </button>
                  )}
                </div>

                {!hasRolled && (
                  <p className="mission-roll-hint">
                    ระบบจะสุ่มผลตามโอกาสสำเร็จและบันทึกผลทันที
                    โดยไม่สามารถสุ่มซ้ำได้
                  </p>
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
                      disabled={!items.length}
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
                    disabled={busy || !hasRolled || !summary.trim()}
                  >
                    <CheckCircle2 size={15} /> บันทึกผลและส่งผู้ติดตามกลับ
                  </button>
                </div>
              </form>
            ) : (
              <div className="mission-result">
                {selected.resolution_roll && (
                  <div className={`mission-result-roll ${selected.resolution_outcome}`}>
                    <Sparkles size={16} />
                    <span>
                      ผลการสุ่ม · โอกาสสำเร็จ {selected.success_chance_percent}%
                    </span>
                    <strong>{outcomeLabels[selected.resolution_outcome]}</strong>
                  </div>
                )}
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
