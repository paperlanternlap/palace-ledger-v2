import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ClipboardList,
  Dices,
  PackageCheck,
  RefreshCw,
  Search,
  ShoppingBasket,
  Truck,
  X,
} from "lucide-react";
import { ListPagination } from "../../components/ui/ListPagination";
import { useListPagination } from "../../components/ui/useListPagination";
import {
  getAcquisitionRequests,
  reviewAcquisitionRequest,
  rollAcquisitionRequest,
  rollNpcPurchaseHiddenResult,
} from "./acquisitionRequestService";
import {
  ACQUISITION_FILTERS as filters,
  ACQUISITION_OUTCOME_LABELS as outcomeLabels,
  ACQUISITION_ROUTE_LABELS as routeLabels,
  ACQUISITION_STATUS_LABELS as statusLabels,
  ACTIVE_ACQUISITION_STATUSES as activeStatuses,
  getAcquisitionRiskTarget as getRiskTarget,
} from "./acquisitionRequestConfig";

function RequestDetail({ request, onChanged }) {
  const [note, setNote] = useState(request?.staff_note || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!request) {
    return (
      <section className="item-request-detail request-empty">
        <ShoppingBasket size={30} />
        <strong>เลือกคำร้องจัดหา</strong>
        <span>รายละเอียดการเบิก จัดซื้อ และซื้อของจาก NPC จะแสดงที่นี่</span>
      </section>
    );
  }

  const terminal = ["completed", "rejected", "cancelled"].includes(request.status);
  const fulfillmentMin = request.request_route === "command"
    ? Math.max(0, (request.item?.fulfillment_days_min ?? 0) - 1)
    : request.item?.fulfillment_days_min ?? 0;
  const fulfillmentMax = request.request_route === "command"
    ? Math.max(fulfillmentMin, (request.item?.fulfillment_days_max ?? 0) - 2)
    : request.item?.fulfillment_days_max ?? 0;

  async function changeStatus(status) {
    if (["rejected", "cancelled"].includes(status) && !note.trim()) {
      setError("กรุณาระบุเหตุผลก่อนปิดคำร้อง");
      return;
    }
    setBusy(true);
    setError("");
    const { error: updateError } = await reviewAcquisitionRequest(
      request.id,
      status,
      note.trim(),
    );
    setBusy(false);
    if (updateError) {
      setError(updateError.message || "เปลี่ยนสถานะไม่สำเร็จ");
      return;
    }
    onChanged(request.id);
  }

  async function roll() {
    setBusy(true);
    setError("");
    const { error: rollError } = await rollAcquisitionRequest(request.id);
    setBusy(false);
    if (rollError) {
      setError(rollError.message || "ทอยผลไม่สำเร็จ");
      return;
    }
    onChanged(request.id);
  }

  async function rollHiddenResult() {
    setBusy(true);
    setError("");
    const { error: rollError } = await rollNpcPurchaseHiddenResult(request.id);
    setBusy(false);
    if (rollError) {
      setError(rollError.message || "ทอยผลลับไม่สำเร็จ");
      return;
    }
    onChanged(request.id);
  }

  return (
    <section className="item-request-detail">
      <header className="item-request-detail-head">
        <div>
          <div className="request-heading-badges">
            <span className={`item-request-status ${request.status}`}>
              {statusLabels[request.status] || request.status}
            </span>
            <span className="request-type">
              {routeLabels[request.request_route] || request.request_route}
            </span>
          </div>
          <h2>{request.item?.name || "ไม่พบไอเท็ม"}</h2>
          <p>
            {request.character?.character_name || "ไม่พบตัวละคร"} · ผู้เล่น{" "}
            {request.character?.player_name || "—"}
          </p>
        </div>
        <div className="reserved-item">
          <span>จำนวน</span>
          <strong>{request.quantity} ชิ้น</strong>
        </div>
      </header>

      <div className="request-detail-grid">
        <div><span>เส้นทาง</span><strong>{routeLabels[request.request_route]}</strong></div>
        <div><span>ราคา</span><strong>{request.item?.cost || 0} RP / ชิ้น</strong></div>
        <div><span>หักแล้ว</span><strong>{request.charged_amount || 0} RP</strong></div>
        <div>
          <span>เวลา IC</span>
          <strong>
            {fulfillmentMin}–{fulfillmentMax} วัน
          </strong>
        </div>
        {request.player_note && (
          <div className="wide"><span>หมายเหตุผู้เล่น</span><strong>{request.player_note}</strong></div>
        )}
        {request.channel && (
          <div className="wide">
            <span>NPC ผู้จัดหา</span>
            <strong>{request.channel.npc_name} · {request.channel.npc_role}</strong>
          </div>
        )}
      </div>

      {request.success_chance_percent && (
        <div className="closed-request-note">
          <span>การจัดหาแบบเสี่ยง · โอกาส {request.success_chance_percent}%</span>
          <p>
            {request.resolution_roll
              ? `ผลทอย ${request.resolution_roll} — ${outcomeLabels[request.resolution_outcome] || request.resolution_outcome}`
              : "ยังไม่ได้ทอย"}
          </p>
        </div>
      )}

      {request.request_route === "restricted_contact" && request.resolution_roll && (
        <div className="closed-request-note">
          <span>ผลเจรจาที่ผู้เล่นเห็น</span>
          <p>
            {request.npc_opposed_roll
              ? `NPC ${request.npc_opposed_roll} ปะทะ ผู้เล่น ${request.resolution_roll}`
              : getRiskTarget(request.item?.acquisition_risk_level)
                ? `เกณฑ์มากกว่า ${getRiskTarget(request.item?.acquisition_risk_level)} · ผู้เล่น ${request.resolution_roll}`
                : `ผู้เล่น ${request.resolution_roll} · ผลจากกติกาเดิม`}
            {` — ${outcomeLabels[request.resolution_outcome] || request.resolution_outcome}`}
          </p>
          <p>
            {request.npc_opposed_roll
              ? "กติกาความเสี่ยงต่ำ: ระบบทอยให้ NPC อัตโนมัติ ผู้เล่นกดทอยของตนเอง และต้องได้มากกว่า NPC"
              : getRiskTarget(request.item?.acquisition_risk_level)
                ? `กติกาความเสี่ยงระดับ ${request.item?.acquisition_risk_level}: ผู้เล่นต้องทอยได้มากกว่า ${getRiskTarget(request.item?.acquisition_risk_level)}`
                : "คำขอนี้สร้างก่อนเริ่มใช้ระบบทอยตามระดับความเสี่ยง"}
          </p>
          {request.resolution_outcome && !["success", "critical_success"].includes(request.resolution_outcome) && (
            <p>RP เป็นค่าดำเนินการและไม่คืนเมื่อการเจรจาไม่ผ่าน</p>
          )}
        </div>
      )}

      {request.consequence && (
        <div className="closed-request-note">
          <span>ผลกระทบจากการทอย</span>
          <p>{request.consequence}</p>
        </div>
      )}

      {request.staff_hidden_roll && (
        <div className="closed-request-note">
          <span>ผลลับสำหรับสต๊าฟเท่านั้น</span>
          <p>d100 = {request.staff_hidden_roll} · ใช้ประกอบระดับความเสี่ยงและบันทึกผลที่เกิดขึ้นในโน้ตของสต๊าฟ</p>
        </div>
      )}

      {!terminal && (
        <div className="item-request-review">
          <label>
            โน้ตของสต๊าฟ
            <textarea
              rows="3"
              value={note}
              placeholder="ผลตรวจ รายละเอียดการจัดซื้อ หรือผลกระทบ..."
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          {error && <p>{error}</p>}
          <div className="item-request-actions">
            {request.request_route === "restricted_contact"
              && ["risk_review", "procuring"].includes(request.status)
              && !request.staff_hidden_roll && (
              <button className="request-wait" type="button" disabled={busy} onClick={rollHiddenResult}>
                <Dices size={15} /> ทอยผลลับ d100
              </button>
            )}
            {request.status === "submitted" && (
              <>
                <button className="request-reject" type="button" disabled={busy} onClick={() => changeStatus("rejected")}>
                  <X size={15} /> ไม่อนุมัติ
                </button>
                <button className="request-approve" type="button" disabled={busy} onClick={() => changeStatus("approved")}>
                  <Check size={15} /> อนุมัติคำร้อง
                </button>
              </>
            )}
            {request.status === "awaiting_roll" && !request.resolution_roll && (
              <button className="request-wait" type="button" disabled={busy} onClick={roll}>
                <Dices size={15} /> ทอย d100
              </button>
            )}
            {request.status === "awaiting_roll" && request.resolution_roll && (
              <button className="request-reject" type="button" disabled={busy} onClick={() => changeStatus("rejected")}>
                <X size={15} /> ปิดคำร้องตามผลล้มเหลว
              </button>
            )}
            {request.status === "risk_review" && (
              <button className="request-reject" type="button" disabled={busy} onClick={() => changeStatus("rejected")}> 
                <X size={15} /> {request.charged_amount ? "ปิดคำร้อง (ไม่คืน RP)" : "สรุปผลและปิดคำร้อง"}
              </button>
            )}
            {request.status === "procuring" && (
              <>
                {request.staff_hidden_roll && (
                  <button className="request-reject" type="button" disabled={busy} onClick={() => changeStatus("rejected")}>
                    <X size={15} /> ปิดคำร้องตามผลลับ
                  </button>
                )}
                <button className="request-approve" type="button" disabled={busy} onClick={() => changeStatus("ready")}>
                  <Truck size={15} /> จัดหาแล้ว พร้อมส่งมอบ
                </button>
              </>
            )}
            {request.status === "ready" && (
              <button className="request-approve" type="button" disabled={busy} onClick={() => changeStatus("completed")}>
                <PackageCheck size={15} /> ส่งมอบเข้าคลังผู้เล่น
              </button>
            )}
          </div>
        </div>
      )}
      {terminal && request.staff_note && (
        <div className="closed-request-note"><span>สรุปจากสต๊าฟ</span><p>{request.staff_note}</p></div>
      )}
    </section>
  );
}

export function AcquisitionRequestQueue() {
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);

  async function loadRequests(preferredId) {
    setLoading(true);
    const { data, error } = await getAcquisitionRequests();
    if (error) {
      setSetupRequired(error.code === "42P01" || error.code === "PGRST205");
      setRequests([]);
      setSelected(null);
    } else {
      setSetupRequired(false);
      setRequests(data || []);
      setSelected((current) =>
        data?.find((request) => request.id === (preferredId || current?.id)) || null,
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(loadRequests, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("th");
    return requests.filter((request) => {
      const matchesFilter = filter === "all"
        || (filter === "active" && activeStatuses.includes(request.status))
        || request.status === filter;
      const text = [request.character?.character_name, request.character?.player_name, request.item?.name]
        .filter(Boolean).join(" ").toLocaleLowerCase("th");
      return matchesFilter && (!keyword || text.includes(keyword));
    });
  }, [filter, requests, search]);
  const pages = useListPagination(filtered, 6, `${filter}|${search}`);

  return (
    <section className="item-request-workspace">
      <aside className="item-request-directory">
        <div className="item-request-tools">
          <div className="request-directory-heading">
            <div><h2>คำร้องจัดหาไอเท็ม</h2><span>{filtered.length} รายการ</span></div>
            <button type="button" disabled={loading} onClick={() => loadRequests()}>
              <RefreshCw size={13} /> รีเฟรช
            </button>
          </div>
          <div className="search-box">
            <Search size={17} />
            <input type="search" value={search} placeholder="ค้นหาตัวละครหรือไอเท็ม" onChange={(event) => setSearch(event.target.value)} />
          </div>
          <label className="item-request-status-filter">
            <span>สถานะ</span>
            <select
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
                setSelected(null);
              }}
            >
              {filters.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
        </div>
        {setupRequired ? (
          <div className="request-setup-inline">
            <ClipboardList size={25} />
            <strong>ยังไม่ได้ติดตั้งระบบคำร้องจัดหา</strong>
            <code>20260814000000_add_item_acquisition_workflow.sql</code>
          </div>
        ) : loading ? (
          <p className="request-message">กำลังโหลดคำร้อง...</p>
        ) : (
          <>
            <div className="item-request-list">
              {pages.pageItems.map((request) => (
                <button
                  type="button"
                  key={request.id}
                  className={`item-request-row ${selected?.id === request.id ? "selected" : ""}`}
                  onClick={() => setSelected(request)}
                >
                  <div className="request-row-icon"><ShoppingBasket size={19} /></div>
                  <span className="request-row-copy">
                    <strong>{request.character?.character_name || "ไม่พบตัวละคร"}</strong>
                    <small>{request.item?.name || "ไม่พบไอเท็ม"} ×{request.quantity}</small>
                    <small>{routeLabels[request.request_route]}</small>
                  </span>
                  <span className="request-row-meta">
                    <span className={`item-request-status ${request.status}`}>{statusLabels[request.status]}</span>
                  </span>
                </button>
              ))}
            </div>
            <ListPagination currentPage={pages.currentPage} totalPages={pages.totalPages} onPageChange={pages.setPage} label="หน้าคำร้องจัดหา" />
          </>
        )}
      </aside>
      <RequestDetail key={selected?.id || "empty"} request={selected} onChanged={loadRequests} />
    </section>
  );
}
