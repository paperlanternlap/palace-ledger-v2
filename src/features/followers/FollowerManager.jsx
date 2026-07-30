import { useEffect, useMemo, useState } from "react";
import {
  BrainCircuit,
  ChevronDown,
  Compass,
  DoorOpen,
  MapPin,
  Pencil,
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
  EditFollowerModal,
} from "./FollowerModal";
import {
  getFollowers,
  releaseFollower,
} from "./followerService";
import { FollowerMissionQueue } from "./FollowerMissionQueue";
import { FollowerLocationManager } from "./FollowerLocationManager";

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
  gardener: "คนสวน",
  physician: "หมอ / ผู้ช่วยแพทย์",
  guard: "ทหาร / องครักษ์",
  merchant: "พ่อค้า",
  tailor: "ช่างเย็บปัก",
  scribe: "เสมียน",
  courier: "คนส่งของ",
  ritual_attendant: "ผู้ดูแลงานพิธี",
  other: "อื่น ๆ",
};

const talentGroupDefinitions = [
  {
    id: "intelligence",
    label: "ข่าวสารและการสืบค้น",
    keys: ["ข่าว", "ข่าวห้องเครื่อง", "ข่าววังหลัง", "ข่าวพระสนม", "การเมือง", "ติดตามคน", "ความลับ", "บุคคลเข้าออก"],
  },
  {
    id: "medicine",
    label: "แพทย์และธรรมชาติ",
    keys: ["สวน", "สมุนไพร", "การแพทย์", "ยา"],
  },
  {
    id: "resources",
    label: "ครัวและทรัพยากร",
    keys: ["อาหาร", "วัตถุดิบ"],
  },
  {
    id: "craft",
    label: "งานช่างและพิธีการ",
    keys: ["เครื่องแต่งกาย", "งานฝีมือ", "พิธีการ", "คัมภีร์"],
  },
  {
    id: "commerce",
    label: "การค้าและเอกสาร",
    keys: ["การค้า", "เอกสาร", "การเงิน"],
  },
  {
    id: "field",
    label: "การเดินทางและความปลอดภัย",
    keys: ["การเดินทาง", "ประตู", "อาวุธ"],
  },
];

function getTalentGroup(talentKey) {
  return (
    talentGroupDefinitions.find((group) => group.keys.includes(talentKey)) || {
      id: "other",
      label: "ความถนัดอื่น ๆ",
    }
  );
}

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

function FollowerDetail({ follower, busy, onAssign, onEdit, onRelease }) {
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
          <span>ภารกิจต่อสัปดาห์</span>
          <strong>{follower.weekly_mission_limit}</strong>
        </div>
      </div>

      <div className="follower-capabilities">
        <div className="follower-tag-group">
          <div>
            <BrainCircuit size={16} />
            <strong>Talent สำรวจ</strong>
          </div>
          <div>
            {follower.talents?.length ? (
              follower.talents.map((talent) => (
                <span
                  key={talent.id || talent.talent_key}
                  className={talent.modifier_percent < 0 ? "negative" : "positive"}
                >
                  {talent.label || talent.talent_key}{" "}
                  <b>
                    {talent.modifier_percent > 0 ? "+" : ""}
                    {talent.modifier_percent}%
                  </b>
                </span>
              ))
            ) : (
              <small>ยังไม่ได้กำหนด Talent</small>
            )}
          </div>
        </div>
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
        <button
          type="button"
          className="follower-edit-button"
          disabled={busy}
          onClick={() => onEdit(follower)}
        >
          <Pencil size={15} /> แก้ไขข้อมูล
        </button>
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
  const [editing, setEditing] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [section, setSection] = useState("registry");
  const [showInsights, setShowInsights] = useState(false);

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
        ...(follower.talents || []).flatMap((talent) => [
          talent.talent_key,
          talent.label,
        ]),
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
    const talentCounts = followers.reduce((result, follower) => {
      (follower.talents || []).forEach((talent) => {
        const talentKey = talent.talent_key || "อื่น ๆ";
        const label = talent.label || talentKey;
        const id = `${talentKey}::${label}`;
        result[id] = result[id] || {
          key: talentKey,
          label,
          count: 0,
        };
        result[id].count += 1;
      });
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
      talentGroups: Object.values(talentCounts)
        .sort((a, b) => b.count - a.count)
        .reduce((groups, talent) => {
          const group = getTalentGroup(talent.key);
          const current = groups.find((item) => item.id === group.id);
          if (current) {
            current.items.push(talent);
          } else {
            groups.push({ ...group, items: [talent] });
          }
          return groups;
        }, []),
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
        <div className="follower-nav-row">
          <div className="follower-section-tabs">
            <button
              type="button"
              className={section === "registry" ? "active" : ""}
              onClick={() => setSection("registry")}
            >
              ทะเบียนผู้ติดตาม
            </button>
            <button
              type="button"
              className={section === "missions" ? "active" : ""}
              onClick={() => setSection("missions")}
            >
              ภารกิจสำรวจ
            </button>
            <button
              type="button"
              className={section === "locations" ? "active" : ""}
              onClick={() => setSection("locations")}
            >
              จัดการโลเคชั่น
            </button>
            <span>
              {section === "registry"
                ? "จัดการเจ้าของ ความสามารถ และพื้นที่เข้าถึง"
                : section === "missions"
                  ? "สรุปผล ส่งรางวัล และคืนผู้ติดตามให้ลูกมู"
                  : "ตั้งค่าพื้นที่ Tag และโอกาสสำเร็จพื้นฐาน"}
            </span>
          </div>
        </div>

        {section === "registry" && (
          <div className="follower-registry-controls">
            <div className="follower-filter-row">
              <div className="follower-overview" aria-label="กรองตามสถานะ">
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
              <button
                type="button"
                className={`follower-insights-trigger ${showInsights ? "active" : ""}`}
                aria-expanded={showInsights}
                onClick={() => setShowInsights((current) => !current)}
              >
                <BrainCircuit size={15} />
                ดูภาพรวมความถนัดและพื้นที่
                <ChevronDown size={14} />
              </button>
            </div>
            {showInsights && (
              <div className="follower-insights">
                <div>
                  <span className="follower-insight-title">
                    <BrainCircuit size={15} /> สายความถนัดที่มี
                  </span>
                  <div>
                    {overview.talentGroups.length ? (
                      <div className="follower-talent-groups">
                        {overview.talentGroups.map((group) => (
                          <section className="follower-talent-cluster" key={group.id}>
                            <h4>
                              {group.label}
                              <span>{group.items.length}</span>
                            </h4>
                            <div>
                              {group.items.map((talent) => (
                                <span key={`${talent.key}-${talent.label}`}>
                                  {talent.label} <strong>{talent.count}</strong>
                                </span>
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
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
            )}
          </div>
        )}

        {section === "missions" ? (
          <FollowerMissionQueue
            onMissionChanged={async () => {
              await loadFollowers(null, false);
            }}
          />
        ) : section === "locations" ? (
          <FollowerLocationManager />
        ) : (
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
          onEdit={setEditing}
          onRelease={handleRelease}
        />
        </div>
        )}
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

      {editing && (
        <EditFollowerModal
          follower={editing}
          onClose={() => setEditing(null)}
          onSaved={async (followerId) => {
            setEditing(null);
            await loadFollowers(followerId);
          }}
        />
      )}
    </>
  );
}
