import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardList,
  ExternalLink,
  EyeOff,
  PackageCheck,
  Plus,
  RotateCcw,
  Search,
  Send,
  X,
} from "lucide-react";
import {
  ListPagination,
} from "../../components/ui/ListPagination";
import { useListPagination } from "../../components/ui/useListPagination";
import { CreateItemRequestModal } from "./CreateItemRequestModal";
import {
  getItemUseRequests,
  reviewItemUseRequest,
  setItemRequestTaskStatus,
} from "./itemRequestService";

const filters = [
  { id: "active", label: "กำลังดำเนินการ" },
  { id: "submitted", label: "รอตรวจ" },
  { id: "awaiting_player", label: "รอผู้เล่น" },
  { id: "completed", label: "เสร็จสิ้น" },
  { id: "all", label: "ทั้งหมด" },
];

const statusLabels = {
  submitted: "รอตรวจ",
  revision: "ส่งกลับแก้ไข",
  approved: "อนุมัติแล้ว",
  action_pending: "รอแม่งานดำเนินการ",
  awaiting_player: "รอผู้เล่นตอบหรือทอย",
  completed: "เสร็จสิ้น",
  rejected: "ไม่อนุมัติ",
  cancelled: "ยกเลิก",
};

const typeLabels = {
  self: "ใช้กับตัวเอง",
  target: "ใช้กับตัวละครอื่น",
  secret_plan: "แผนลับ / ใส่ร้าย",
  shared_plot: "พล็อตร่วมกัน",
  unlock: "เปิดอีเวนต์หรือพื้นที่",
  defense: "ป้องกันหรือรักษา",
};

const activeStatuses = [
  "submitted",
  "revision",
  "approved",
  "action_pending",
  "awaiting_player",
];

function displayTaskLabel(label) {
  return label === "ตรวจช่องทาง ผู้ลงมือ และผลกระทบ"
    ? "ตรวจช่องทาง NPC ที่เกี่ยวข้อง และผลกระทบ"
    : label;
}

function RequestList({ requests, selectedId, loading, onSelect }) {
  if (loading) {
    return <p className="request-message">กำลังโหลดคำร้อง...</p>;
  }

  if (!requests.length) {
    return (
      <div className="request-empty">
        <ClipboardList size={26} />
        <strong>ไม่มีคำร้องในหมวดนี้</strong>
        <span>คำร้องใหม่จะเข้ามาเรียงตามเวลาที่ส่ง</span>
      </div>
    );
  }

  return (
    <div className="item-request-list">
      {requests.map((request) => {
        const tasks = [...(request.tasks || [])].sort(
          (a, b) => a.sort_order - b.sort_order,
        );
        const done = tasks.filter((task) => task.status !== "pending").length;
        return (
          <button
            type="button"
            key={request.id}
            className={`item-request-row ${
              selectedId === request.id ? "selected" : ""
            }`}
            onClick={() => onSelect(request)}
          >
            <div className="request-row-icon">
              {request.requester?.avatar_url ? (
                <img src={request.requester.avatar_url} alt="" loading="lazy" decoding="async" />
              ) : (
                <PackageCheck size={19} />
              )}
            </div>
            <span className="request-row-copy">
              <span>
                <strong>
                  {request.requester?.character_name || "ไม่พบตัวละคร"}
                </strong>
                {request.secrecy_level !== "normal" && (
                  <EyeOff size={12} aria-label="คำร้องลับ" />
                )}
              </span>
              <small>
                {request.item?.name || "ไม่พบไอเท็ม"} ×{request.quantity}
              </small>
              <small>{request.desired_effect}</small>
            </span>
            <span className="request-row-meta">
              <span className={`item-request-status ${request.status}`}>
                {statusLabels[request.status] || request.status}
              </span>
              <small>{tasks.length ? `${done}/${tasks.length} ขั้นตอน` : "—"}</small>
              <ChevronRight size={15} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

function DetailField({ label, children, wide = false }) {
  return (
    <div className={wide ? "wide" : ""}>
      <span>{label}</span>
      <strong>{children || "—"}</strong>
    </div>
  );
}

function RequestDetail({ request, onChanged }) {
  const [note, setNote] = useState(request?.staff_note || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!request) {
    return (
      <section className="item-request-detail request-empty">
        <ClipboardList size={30} />
        <strong>เลือกคำร้องเพื่อดูสิ่งที่ต้องทำ</strong>
        <span>รายละเอียด แผน และ checklist ของแม่งานจะแสดงตรงนี้</span>
      </section>
    );
  }

  const tasks = [...(request.tasks || [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const completedTasks = tasks.filter((task) => task.status !== "pending").length;
  const allTasksDone = tasks.length > 0 && completedTasks === tasks.length;
  const terminal = ["completed", "rejected", "cancelled"].includes(
    request.status,
  );

  async function changeStatus(status) {
    if (["revision", "rejected"].includes(status) && !note.trim()) {
      setError("กรุณาเขียนเหตุผลก่อนส่งกลับหรือไม่อนุมัติ");
      return;
    }
    if (status === "completed" && !allTasksDone) {
      setError("กรุณาทำ checklist ให้ครบก่อนปิดคำร้อง");
      return;
    }
    setBusy(true);
    setError("");
    const { error: updateError } = await reviewItemUseRequest(
      request.id,
      status,
      note.trim(),
    );
    setBusy(false);
    if (updateError) {
      setError(updateError.message || "เปลี่ยนสถานะไม่สำเร็จ");
      return;
    }
    onChanged(null, false);
  }

  async function toggleTask(task) {
    if (terminal) return;
    setBusy(true);
    setError("");
    const { error: taskError } = await setItemRequestTaskStatus(
      task.id,
      task.status === "pending" ? "done" : "pending",
    );
    setBusy(false);
    if (taskError) {
      setError(taskError.message || "บันทึก checklist ไม่สำเร็จ");
      return;
    }
    onChanged(request.id, true);
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
              {typeLabels[request.request_type] || request.request_type}
            </span>
            {request.secrecy_level !== "normal" && (
              <span className="secret-badge">
                <EyeOff size={12} />
                {request.secrecy_level === "anonymous"
                  ? "ไม่เปิดเผยผู้วางแผน"
                  : "เฉพาะสต๊าฟ"}
              </span>
            )}
          </div>
          <h2>{request.item?.name || "ไม่พบไอเท็ม"}</h2>
          <p>
            {request.requester?.character_name || "ไม่พบตัวละคร"} · ผู้เล่น{" "}
            {request.requester?.player_name || "—"}
          </p>
        </div>
        <div className="reserved-item">
          <span>{request.item_reserved ? "จองไว้" : "สถานะไอเท็ม"}</span>
          <strong>
            {request.item_reserved ? `${request.quantity} ชิ้น` : "ดำเนินการแล้ว"}
          </strong>
        </div>
      </header>

      <div className="request-detail-grid">
        <DetailField label="เป้าหมาย">
          {request.target?.character_name ||
            (request.request_type === "self" ? "ตนเอง" : "ไม่ระบุ")}
        </DetailField>
        <DetailField label="NPC ผู้ดำเนินการ">
          {request.actor_name}
        </DetailField>
        <DetailField label="ช่องทาง">{request.use_channel}</DetailField>
        <DetailField label="ส่งเมื่อ">
          {new Date(request.submitted_at).toLocaleString("th-TH")}
        </DetailField>
        <DetailField label="ผลที่ต้องการ" wide>
          {request.desired_effect}
        </DetailField>
        {request.details && (
          <DetailField label="รายละเอียดแผน" wide>
            {request.details}
          </DetailField>
        )}
      </div>

      {request.role_url && (
        <a
          className="request-role-link"
          href={request.role_url}
          target="_blank"
          rel="noreferrer"
        >
          เปิดโรลหรือหลักฐาน <ExternalLink size={14} />
        </a>
      )}

      <div className="request-checklist">
        <div className="request-section-title">
          <div>
            <CheckCircle2 size={18} />
            <h3>งานที่ต้องดำเนินการ</h3>
          </div>
          <span>
            {completedTasks}/{tasks.length} เสร็จแล้ว
          </span>
        </div>
        <div className="task-progress">
          <span
            style={{
              width: tasks.length
                ? `${(completedTasks / tasks.length) * 100}%`
                : "0%",
            }}
          />
        </div>
        <div className="request-task-list">
          {tasks.map((task) => (
            <button
              type="button"
              key={task.id}
              className={task.status !== "pending" ? "done" : ""}
              disabled={busy || terminal}
              onClick={() => toggleTask(task)}
            >
              {task.status !== "pending" ? (
                <CheckCircle2 size={18} />
              ) : (
                <Circle size={18} />
              )}
              <span>
                <strong>{displayTaskLabel(task.label)}</strong>
                <small>
                  {task.task_type === "player_action"
                    ? "รอการตอบกลับจากผู้เล่น"
                    : task.task_type === "validation"
                      ? "ขั้นตรวจสอบ"
                      : "งานของแม่งาน"}
                </small>
              </span>
            </button>
          ))}
        </div>
      </div>

      {!terminal && (
        <div className="item-request-review">
          <label>
            โน้ตของสต๊าฟ
            <textarea
              rows="2"
              value={note}
              placeholder="ผลตรวจ เหตุผล หรือสิ่งที่ต้องทำเพิ่มเติม..."
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          {error && <p>{error}</p>}
          <div className="item-request-actions">
            {request.status === "submitted" || request.status === "revision" ? (
              <>
                <button
                  type="button"
                  className="request-reject"
                  disabled={busy}
                  onClick={() => changeStatus("rejected")}
                >
                  <X size={15} /> ไม่อนุมัติ
                </button>
                <button
                  type="button"
                  className="request-revision"
                  disabled={busy}
                  onClick={() => changeStatus("revision")}
                >
                  <RotateCcw size={15} /> ส่งกลับแก้ไข
                </button>
                <button
                  type="button"
                  className="request-approve"
                  disabled={busy}
                  onClick={() => changeStatus("action_pending")}
                >
                  <Check size={15} /> อนุมัติและเริ่มดำเนินการ
                </button>
              </>
            ) : (
              <>
                {request.status !== "awaiting_player" && (
                  <button
                    type="button"
                    className="request-wait"
                    disabled={busy}
                    onClick={() => changeStatus("awaiting_player")}
                  >
                    <Send size={15} /> รอผู้เล่นตอบหรือทอย
                  </button>
                )}
                <button
                  type="button"
                  className="request-approve"
                  disabled={busy || !allTasksDone}
                  onClick={() => changeStatus("completed")}
                  title={!allTasksDone ? "ทำ checklist ให้ครบก่อน" : undefined}
                >
                  <Check size={15} /> ปิดคำร้อง
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {terminal && request.staff_note && (
        <div className="closed-request-note">
          <span>สรุปจากสต๊าฟ</span>
          <p>{request.staff_note}</p>
        </div>
      )}
    </section>
  );
}

export function ItemRequestQueue() {
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  async function loadRequests(preferredId, preserveCurrent = true) {
    if (!preserveCurrent) {
      setSelected(null);
    }
    setLoading(true);
    const { data, error } = await getItemUseRequests();
    if (error) {
      setSetupRequired(
        error.code === "42P01" ||
          error.code === "PGRST205" ||
          error.message?.includes("item_use_requests"),
      );
      setRequests([]);
      setSelected(null);
    } else {
      setSetupRequired(false);
      setRequests(data || []);
      setSelected((current) => {
        const id = preferredId || (preserveCurrent ? current?.id : null);
        return data?.find((request) => request.id === id) || null;
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(loadRequests, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filteredRequests = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("th");
    return requests.filter((request) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "active" && activeStatuses.includes(request.status)) ||
        request.status === filter;
      const text = [
        request.requester?.character_name,
        request.requester?.player_name,
        request.target?.character_name,
        request.item?.name,
        request.desired_effect,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("th");
      return matchesFilter && (!keyword || text.includes(keyword));
    });
  }, [filter, requests, search]);

  const requestPages = useListPagination(
    filteredRequests,
    5,
    `${filter}|${search}`,
  );

  return (
    <>
      <section className="item-request-workspace">
        <aside className="item-request-directory">
          <div className="item-request-tools">
            <div className="request-directory-heading">
              <div>
                <h2>คำร้องและงานแม่งาน</h2>
                <span>{filteredRequests.length} รายการ</span>
              </div>
              <button
                type="button"
                disabled={setupRequired}
                onClick={() => setShowCreate(true)}
              >
                <Plus size={14} /> เพิ่มคำร้อง
              </button>
            </div>
            <div className="search-box">
              <Search size={17} />
              <input
                type="search"
                value={search}
                placeholder="ค้นหาตัวละคร ไอเท็ม หรือผลที่ขอ"
                onChange={(event) => setSearch(event.target.value)}
              />
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
              <strong>ต้องเพิ่มตารางคำร้องก่อน</strong>
              <span>หน้าตาพร้อมให้ตรวจแล้ว ข้อมูลจริงจะขึ้นหลังรัน SQL</span>
              <code>20260730_create_item_use_requests.sql</code>
            </div>
          ) : (
            <>
              <RequestList
                requests={requestPages.pageItems}
                selectedId={selected?.id}
                loading={loading}
                onSelect={setSelected}
              />
              <ListPagination
                currentPage={requestPages.currentPage}
                totalPages={requestPages.totalPages}
                onPageChange={(page) => {
                  requestPages.setPage(page);
                  setSelected(null);
                }}
                label="หน้ารายการคำร้อง"
              />
            </>
          )}
        </aside>

        <RequestDetail
          key={selected?.id || "empty"}
          request={selected}
          onChanged={loadRequests}
        />
      </section>

      {showCreate && (
        <CreateItemRequestModal
          onClose={() => setShowCreate(false)}
          onCreated={async (requestId) => {
            setShowCreate(false);
            setFilter("active");
            await loadRequests(requestId);
          }}
        />
      )}
    </>
  );
}
