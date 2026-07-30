import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Clock3,
  ExternalLink,
  FileWarning,
  Link2,
  Plus,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import {
  ListPagination,
} from "../../components/ui/ListPagination";
import { useListPagination } from "../../components/ui/useListPagination";
import {
  getRpSubmissions,
  reviewRpSubmission,
} from "./rpQueueService";
import { CreateSubmissionModal } from "./CreateSubmissionModal";

const filters = [
  { id: "pending", label: "รอตรวจ" },
  { id: "revision", label: "ส่งกลับแก้ไข" },
  { id: "approved", label: "อนุมัติแล้ว" },
  { id: "rejected", label: "ไม่ผ่าน" },
  { id: "all", label: "ทั้งหมด" },
];

const statusLabels = {
  pending: "รอตรวจ",
  revision: "ส่งกลับแก้ไข",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่ผ่าน",
};

function SubmissionList({
  submissions,
  selectedId,
  loading,
  onSelect,
}) {
  if (loading) {
    return <p className="queue-message">กำลังโหลดคิวตรวจผลงาน...</p>;
  }

  if (!submissions.length) {
    return (
      <div className="queue-empty">
        <Clock3 size={24} />
        <strong>ไม่มีรายการในสถานะนี้</strong>
        <span>รายการที่ลูกมูส่งจะปรากฏที่นี่</span>
      </div>
    );
  }

  return (
    <div className="submission-list">
      {submissions.map((submission) => (
        <button
          type="button"
          key={submission.id}
          className={`submission-row ${
            submission.id === selectedId ? "selected" : ""
          }`}
          onClick={() => onSelect(submission)}
        >
          {submission.characters?.avatar_url ? (
            <img src={submission.characters.avatar_url} alt="" />
          ) : (
            <div className="submission-avatar">
              {(submission.characters?.character_name || "?").slice(0, 1)}
            </div>
          )}
          <span>
            <strong>
              {submission.characters?.character_name || "ไม่พบตัวละคร"}
            </strong>
            <small>{submission.submission_type || "โรลเพลย์"}</small>
          </span>
          <time>
            {new Date(submission.submitted_at).toLocaleDateString("th-TH", {
              day: "numeric",
              month: "short",
            })}
          </time>
        </button>
      ))}
    </div>
  );
}

function ReviewPanel({ submission, onReviewed }) {
  const [rp, setRp] = useState(submission?.awarded_rp || 0);
  const [favor, setFavor] = useState(submission?.awarded_favor || 0);
  const [note, setNote] = useState(submission?.staff_note || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!submission) {
    return (
      <section className="review-panel queue-empty">
        <Link2 size={28} />
        <strong>เลือกรายการเพื่อเริ่มตรวจ</strong>
        <span>รายละเอียดผลงานและเครื่องมือให้คะแนนจะแสดงตรงนี้</span>
      </section>
    );
  }

  async function submitReview(status) {
    if (status !== "approved" && !note.trim()) {
      setError("กรุณาระบุเหตุผลก่อนส่งกลับหรือไม่อนุมัติ");
      return;
    }

    setSubmitting(true);
    setError("");
    const { error: reviewError } = await reviewRpSubmission({
      submissionId: submission.id,
      status,
      rp: Number(rp) || 0,
      favor: Number(favor) || 0,
      note: note.trim(),
    });
    setSubmitting(false);

    if (reviewError) {
      setError(reviewError.message || "บันทึกผลตรวจไม่สำเร็จ");
      return;
    }
    onReviewed();
  }

  return (
    <section className="review-panel">
      <header className="review-header">
        <div>
          <span className={`queue-status ${submission.status}`}>
            {statusLabels[submission.status] || submission.status}
          </span>
          <h2>{submission.characters?.character_name || "ไม่พบตัวละคร"}</h2>
          <p>
            ผู้เล่น {submission.characters?.player_name || "—"} ·{" "}
            {submission.submission_type || "โรลเพลย์"}
          </p>
        </div>
        <a
          href={submission.role_url}
          target="_blank"
          rel="noreferrer"
          className="open-role-button"
        >
          เปิดผลงาน <ExternalLink size={15} />
        </a>
      </header>

      <div className="submission-info">
        <div>
          <span>ส่งเมื่อ</span>
          <strong>
            {new Date(submission.submitted_at).toLocaleString("th-TH")}
          </strong>
        </div>
        <div>
          <span>ผู้ร่วมงาน</span>
          <strong>{submission.participant_names || "ไม่มี"}</strong>
        </div>
        <div className="role-link">
          <span>ลิงก์ผลงานหรือหลักฐาน</span>
          <strong>{submission.role_url}</strong>
        </div>
      </div>

      {submission.player_note && (
        <div className="player-note">
          <span>หมายเหตุจากผู้เล่น</span>
          <p>{submission.player_note}</p>
        </div>
      )}

      <div className="review-form">
        <div className="reward-fields">
          <label>
            RP ที่ได้รับ
            <input
              type="number"
              min="0"
              value={rp}
              onChange={(event) => setRp(event.target.value)}
            />
          </label>
          <label>
            โปรดปราน
            <input
              type="number"
              min="0"
              value={favor}
              onChange={(event) => setFavor(event.target.value)}
            />
          </label>
        </div>

        <label>
          หมายเหตุจากสตาฟ
          <textarea
            rows="3"
            value={note}
            placeholder="แจ้งผล เหตุผล หรือสิ่งที่ต้องแก้ไข..."
            onChange={(event) => setNote(event.target.value)}
          />
        </label>

        {error && <p className="review-error">{error}</p>}

        <div className="review-actions">
          <button
            type="button"
            className="review-reject"
            disabled={submitting}
            onClick={() => submitReview("rejected")}
          >
            <X size={16} /> ไม่ผ่าน
          </button>
          <button
            type="button"
            className="review-revision"
            disabled={submitting}
            onClick={() => submitReview("revision")}
          >
            <RotateCcw size={16} /> ส่งกลับแก้ไข
          </button>
          <button
            type="button"
            className="review-approve"
            disabled={submitting}
            onClick={() => submitReview("approved")}
          >
            <Check size={16} /> อนุมัติและให้คะแนน
          </button>
        </div>
      </div>
    </section>
  );
}

export function RpQueue() {
  const [submissions, setSubmissions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  async function loadQueue(preferredId, preserveCurrent = true) {
    setLoading(true);
    const { data, error } = await getRpSubmissions();

    if (error) {
      setSetupRequired(
        error.code === "42P01" ||
          error.code === "PGRST205" ||
          error.message?.includes("rp_submissions"),
      );
      setSubmissions([]);
    } else {
      setSetupRequired(false);
      setSubmissions(data || []);
      setSelected((current) => {
        const selectedId =
          preferredId || (preserveCurrent ? current?.id : null);
        return data?.find((item) => item.id === selectedId) || null;
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(loadQueue, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filteredSubmissions = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("th");
    return submissions.filter((submission) => {
      const matchesFilter =
        filter === "all" || submission.status === filter;
      const text = [
        submission.characters?.character_name,
        submission.characters?.player_name,
        submission.submission_type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("th");
      return matchesFilter && (!keyword || text.includes(keyword));
    });
  }, [filter, search, submissions]);

  const submissionPages = useListPagination(
    filteredSubmissions,
    6,
    `${filter}|${search}`,
  );

  if (setupRequired) {
    return (
      <section className="queue-setup">
        <div className="setup-icon">
          <FileWarning size={28} />
        </div>
        <h2>คิวตรวจผลงานพร้อมแล้ว แต่ฐานข้อมูลยังไม่มีตาราง</h2>
        <p>
          รันไฟล์ migration ที่เตรียมไว้ใน Supabase SQL Editor
          แล้วเพิ่มบัญชีสตาฟก่อนเปิดใช้งานจริง
        </p>
        <code>supabase/migrations/20260729_create_rp_queue.sql</code>
      </section>
    );
  }

  return (
    <>
      <section className="queue-workspace">
        <aside className="queue-directory">
          <div className="queue-tools">
            <div>
              <div>
                <h2>คิวตรวจผลงาน</h2>
                <span>{filteredSubmissions.length} รายการ</span>
              </div>
              <button
                type="button"
                className="add-submission-button"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus size={14} /> เพิ่มผลงาน
              </button>
            </div>
            <div className="search-box">
              <Search size={17} />
              <input
                type="search"
                value={search}
                placeholder="ค้นหาตัวละครหรือผู้เล่น"
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="queue-filters">
              {filters.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={filter === item.id ? "selected" : ""}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <SubmissionList
            submissions={submissionPages.pageItems}
            selectedId={selected?.id}
            loading={loading}
            onSelect={setSelected}
          />
          <ListPagination
            currentPage={submissionPages.currentPage}
            totalPages={submissionPages.totalPages}
            onPageChange={(page) => {
              submissionPages.setPage(page);
              setSelected(null);
            }}
            label="หน้าคิวตรวจผลงาน"
          />
        </aside>

        <ReviewPanel
          key={selected?.id || "empty"}
          submission={selected}
          onReviewed={() => loadQueue(null, false)}
        />
      </section>

      {showCreateModal && (
        <CreateSubmissionModal
          onClose={() => setShowCreateModal(false)}
          onCreated={async (submissionId) => {
            setShowCreateModal(false);
            setFilter("pending");
            await loadQueue(submissionId);
          }}
        />
      )}
    </>
  );
}
