import { useEffect, useMemo, useState } from "react";
import {
  BrainCircuit,
  Compass,
  DoorOpen,
  MapPin,
  Plus,
  Search,
  Sparkles,
  UserRoundCheck,
  Users,
} from "lucide-react";
import {
  ListPagination,
} from "../../components/ui/ListPagination";
import { useListPagination } from "../../components/ui/useListPagination";
import {
  AssignFollowerModal,
  CreateFollowerModal,
} from "./FollowerModal";
import {
  getFollowers,
  releaseFollower,
} from "./followerService";

const statusLabels = {
  available: "พร้อมรับสมัคร",
  assigned: "มีเจ้าของแล้ว",
  on_mission: "ออกภารกิจ",
  unavailable: "ใช้งานไม่ได้",
};

const typeLabels = {
  close_maid: "นางกำนัลใกล้ชิด",
  maid: "นางกำนัลทั่วไป",
  eunuch: "ขันที",
  kitchen: "คนจากห้องเครื่อง",
  physician: "หมอ / ผู้ช่วยแพทย์",
  guard: "ทหาร / องครักษ์",
  other: "อื่น ๆ",
};

const levelLabels = {
  intelligence: "สืบข่าว",
  negotiation: "เจรจา",
  trade: "การค้า",
  medicine: "การแพทย์",
  stealth: "ลอบเร้น",
  combat: "ต่อสู้",
};

function FollowerList({ followers, selectedId, loading, onSelect }) {
  if (loading) {
    return <p className="follower-message">กำลังโหลดทะเบียนผู้ติดตาม...</p>;
  }
  if (!followers.length) {
    return (
      <div className="follower-empty">
        <Users size={27} />
        <strong>ไม่มีผู้ติดตามในรายการนี้</strong>
        <span>กดเพิ่มผู้ติดตามเพื่อสร้าง NPC คนใหม่</span>
      </div>
    );
  }

  return (
    <div className="follower-list">
      {followers.map((follower) => (
        <button
          type="button"
          key={follower.id}
          className={`follower-row ${
            selectedId === follower.id ? "selected" : ""
          }`}
          onClick={() => onSelect(follower)}
        >
          {follower.avatar_url ? (
            <img src={follower.avatar_url} alt="" />
          ) : (
            <div className="follower-avatar">
              {(follower.name || "?").slice(0, 1)}
            </div>
          )}
          <span>
            <strong>{follower.name}</strong>
            <small>
              {typeLabels[follower.follower_type] || follower.follower_type}
            </small>
            <small>
              {follower.owner?.character_name
                ? `เจ้าของ: ${follower.owner.character_name}`
                : "ยังไม่มีเจ้าของ"}
            </small>
          </span>
          <span className={`follower-status ${follower.view_status}`}>
            {statusLabels[follower.view_status] || follower.status}
          </span>
        </button>
      ))}
    </div>
  );
}

function TagGroup({ icon: Icon, title, tags, emptyText }) {
  return (
    <div className="follower-tag-group">
      <div>
        <Icon size={16} />
        <strong>{title}</strong>
      </div>
      <div>
        {tags?.length ? (
          tags.map((tag) => <span key={tag}>{tag}</span>)
        ) : (
          <small>{emptyText}</small>
        )}
      </div>
    </div>
  );
}

function FollowerDetail({ follower, busy, onAssign, onRelease }) {
  if (!follower) {
    return (
      <section className="follower-detail follower-empty">
        <UserRoundCheck size={30} />
        <strong>เลือกผู้ติดตามเพื่อดูข้อมูล</strong>
        <span>เจ้าของ ความสามารถ และพื้นที่เข้าถึงจะแสดงตรงนี้</span>
      </section>
    );
  }

  return (
    <section className="follower-detail">
      <header className="follower-profile">
        {follower.avatar_url ? (
          <img src={follower.avatar_url} alt="" />
        ) : (
          <div className="follower-profile-placeholder">
            {(follower.name || "?").slice(0, 1)}
          </div>
        )}
        <div>
          <span className={`follower-status ${follower.view_status}`}>
            {statusLabels[follower.view_status] || follower.status}
          </span>
          <h2>{follower.name}</h2>
          <p>
            {typeLabels[follower.follower_type] || follower.follower_type}
          </p>
        </div>
        <div className="follower-owner">
          <span>เจ้าของปัจจุบัน</span>
          <strong>
            {follower.owner?.character_name || "ยังไม่มีเจ้าของ"}
          </strong>
          <small>{follower.owner?.player_name || "พร้อมให้รับสมัคร"}</small>
        </div>
      </header>

      {follower.description && (
        <p className="follower-description">{follower.description}</p>
      )}

      <div className="follower-levels">
        <div>
          <span>ราคาแต้ม</span>
          <strong>{Number(follower.cost || 0).toLocaleString("th-TH")}</strong>
        </div>
        <div>
          <span>ประเภทสกิล</span>
          <strong>
            {levelLabels[follower.skill_type] || follower.skill_type || "—"}
          </strong>
        </div>
        <div>
          <span>ค่าสกิล</span>
          <strong>{follower.skill_value ?? "—"}</strong>
        </div>
        <div>
          <span>ภารกิจต่อสัปดาห์</span>
          <strong>{follower.weekly_mission_limit}</strong>
        </div>
      </div>

      <div className="follower-capabilities">
        <TagGroup
          icon={Sparkles}
          title="พื้นที่เข้าถึง"
          tags={follower.access_areas}
          emptyText="ยังไม่ระบุพื้นที่"
        />
        <TagGroup
          icon={MapPin}
          title="สถานะจากฐานเดิม"
          tags={[follower.status || "idle"]}
          emptyText="idle"
        />
      </div>

      <div className="follower-actions">
        {follower.view_status === "available" ? (
          <button
            type="button"
            className="primary-button"
            disabled={busy}
            onClick={() => onAssign(follower)}
          >
            <UserRoundCheck size={16} /> มอบให้ตัวละคร
          </button>
        ) : follower.view_status === "assigned" ? (
          <button
            type="button"
            className="release-follower-button"
            disabled={busy}
            onClick={() => onRelease(follower)}
          >
            <DoorOpen size={16} /> ปลดเจ้าของและคืนเข้ารายการ
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function FollowerManager() {
  const [followers, setFollowers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [assigning, setAssigning] = useState(null);

  async function loadFollowers(preferredId, preserveCurrent = true) {
    setLoading(true);
    const { data, error } = await getFollowers();
    if (error) {
      setSetupRequired(
          error.code === "42P01" ||
          error.code === "PGRST205" ||
          error.message?.includes("follower_master"),
      );
      setFollowers([]);
      setSelected(null);
    } else {
      setSetupRequired(false);
      setFollowers(data || []);
      setSelected((current) => {
        const id = preferredId || (preserveCurrent ? current?.id : null);
        return data?.find((follower) => follower.id === id) || null;
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(loadFollowers, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filteredFollowers = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("th");
    return followers.filter((follower) => {
      const matchesFilter =
        filter === "all" || follower.view_status === filter;
      const text = [
        follower.name,
        typeLabels[follower.follower_type],
        follower.owner?.character_name,
        follower.owner?.player_name,
        follower.skill_type,
        ...(follower.access_areas || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("th");
      return matchesFilter && (!keyword || text.includes(keyword));
    });
  }, [filter, followers, search]);

  const overview = useMemo(() => {
    const statusCount = (status) =>
      followers.filter((follower) => follower.view_status === status).length;
    const skillCounts = followers.reduce((result, follower) => {
      const skill = follower.skill_type || "other";
      result[skill] = (result[skill] || 0) + 1;
      return result;
    }, {});
    const areaCounts = followers.reduce((result, follower) => {
      (follower.access_areas || []).forEach((area) => {
        result[area] = (result[area] || 0) + 1;
      });
      return result;
    }, {});

    return {
      total: followers.length,
      available: statusCount("available"),
      assigned: statusCount("assigned"),
      onMission: statusCount("on_mission"),
      unavailable: statusCount("unavailable"),
      skills: Object.entries(skillCounts).sort((a, b) => b[1] - a[1]),
      areas: Object.entries(areaCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6),
    };
  }, [followers]);

  const followerPages = useListPagination(
    filteredFollowers,
    5,
    `${filter}|${search}`,
  );

  async function handleRelease(follower) {
    const confirmed = window.confirm(
      `ปลด ${follower.name} ออกจาก ${follower.owner?.character_name} และคืนเป็นผู้ติดตามว่างใช่ไหม`,
    );
    if (!confirmed) return;
    setBusy(true);
    const { error } = await releaseFollower(follower.id);
    setBusy(false);
    if (error) {
      window.alert(error.message || "ปลดผู้ติดตามไม่สำเร็จ");
      return;
    }
    await loadFollowers(follower.id);
  }

  return (
    <>
      <section className="follower-page">
        <div className="follower-overview">
          <button
            type="button"
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            <Users size={18} />
            <span>ทั้งหมด</span>
            <strong>{overview.total}</strong>
          </button>
          <button
            type="button"
            className={filter === "available" ? "active" : ""}
            onClick={() => setFilter("available")}
          >
            <UserRoundCheck size={18} />
            <span>พร้อมรับสมัคร</span>
            <strong>{overview.available}</strong>
          </button>
          <button
            type="button"
            className={filter === "assigned" ? "active" : ""}
            onClick={() => setFilter("assigned")}
          >
            <Users size={18} />
            <span>มีเจ้าของแล้ว</span>
            <strong>{overview.assigned}</strong>
          </button>
          <button
            type="button"
            className={filter === "on_mission" ? "active" : ""}
            onClick={() => setFilter("on_mission")}
          >
            <Compass size={18} />
            <span>กำลังสำรวจ</span>
            <strong>{overview.onMission}</strong>
          </button>
          <button
            type="button"
            className={filter === "unavailable" ? "active" : ""}
            onClick={() => setFilter("unavailable")}
          >
            <DoorOpen size={18} />
            <span>ใช้งานไม่ได้</span>
            <strong>{overview.unavailable}</strong>
          </button>
        </div>

        <div className="follower-insights">
          <div>
            <span className="follower-insight-title">
              <BrainCircuit size={15} /> สายความถนัดที่มี
            </span>
            <div>
              {overview.skills.length ? (
                overview.skills.map(([skill, count]) => (
                  <span key={skill}>
                    {levelLabels[skill] || skill} <strong>{count}</strong>
                  </span>
                ))
              ) : (
                <small>ยังไม่มีข้อมูลสกิล</small>
              )}
            </div>
          </div>
          <div>
            <span className="follower-insight-title">
              <MapPin size={15} /> พื้นที่ที่เข้าถึงได้
            </span>
            <div>
              {overview.areas.length ? (
                overview.areas.map(([area, count]) => (
                  <span key={area}>
                    {area} <strong>{count}</strong>
                  </span>
                ))
              ) : (
                <small>เพิ่มพื้นที่ให้ผู้ติดตามเพื่อเตรียมระบบสำรวจ</small>
              )}
            </div>
          </div>
        </div>

        <div className="follower-section-tabs">
          <button type="button" className="active">ทะเบียนผู้ติดตาม</button>
          <span>ภารกิจสำรวจและคลังผลจะต่อจากข้อมูลชุดนี้</span>
        </div>

        <div className="follower-workspace">
        <aside className="follower-directory">
          <div className="follower-tools">
            <div className="follower-directory-title">
              <div>
                <h2>ทะเบียนผู้ติดตาม</h2>
                <span>{filteredFollowers.length} คน</span>
              </div>
              <button
                type="button"
                disabled={setupRequired}
                onClick={() => setShowCreate(true)}
              >
                <Plus size={14} /> เพิ่มผู้ติดตาม
              </button>
            </div>
            <div className="search-box">
              <Search size={17} />
              <input
                type="search"
                value={search}
                placeholder="ค้นหาชื่อ เจ้าของ หรือความถนัด"
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          {setupRequired ? (
            <div className="follower-setup">
              <Users size={27} />
              <strong>ต้องเพิ่มตารางผู้ติดตามก่อน</strong>
              <span>รัน migration แล้วทะเบียนจริงจะปรากฏตรงนี้</span>
              <code>20260730_upgrade_follower_master.sql</code>
            </div>
          ) : (
            <>
              <FollowerList
                followers={followerPages.pageItems}
                selectedId={selected?.id}
                loading={loading}
                onSelect={setSelected}
              />
              <ListPagination
                currentPage={followerPages.currentPage}
                totalPages={followerPages.totalPages}
                onPageChange={(page) => {
                  followerPages.setPage(page);
                  setSelected(null);
                }}
                label="หน้าทะเบียนผู้ติดตาม"
              />
            </>
          )}
        </aside>

        <FollowerDetail
          follower={selected}
          busy={busy}
          onAssign={setAssigning}
          onRelease={handleRelease}
        />
        </div>
      </section>

      {showCreate && (
        <CreateFollowerModal
          onClose={() => setShowCreate(false)}
          onCreated={async (followerId) => {
            setShowCreate(false);
            await loadFollowers(followerId);
          }}
        />
      )}

      {assigning && (
        <AssignFollowerModal
          follower={assigning}
          onClose={() => setAssigning(null)}
          onAssigned={async () => {
            const followerId = assigning.id;
            setAssigning(null);
            await loadFollowers(followerId);
          }}
        />
      )}
    </>
  );
}
