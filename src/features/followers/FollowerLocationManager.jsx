import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPin, Plus, Save, Search } from "lucide-react";
import PalaceMap from "../../components/PalaceMap";
import { PALACE_LOCATIONS } from "../../data/palaceMap";
import "./map-admin.css";
import { CharacterAccessPicker } from "./CharacterAccessPicker";
import { ListPagination } from "../../components/ui/ListPagination";
import { isMissingMapSchema } from "./locationPayload";
import schemaSQL from "../../../supabase/migrations/20260929000000_map_exploration_v1.sql?raw";
import quotaSQL from "../../../supabase/migrations/20260929002000_remove_exploration_quotas.sql?raw";
import notesSQL from "../../../supabase/migrations/20260929003000_exploration_location_notes.sql?raw";
import playerOutcomeSQL from "../../../supabase/migrations/20260929004000_player_exploration_outcome.sql?raw";
import playerDropSQL from "../../../supabase/migrations/20260929005000_player_exploration_drop_number.sql?raw";
import backfillDropSQL from "../../../supabase/migrations/20260929006000_backfill_exploration_drop_numbers.sql?raw";
import seedSQL from "../../../supabase/migrations/20260929001000_seed_palace_map.sql?raw";
import {
  createExplorationLocation,
  getAllExplorationLocations,
  updateExplorationLocation,
  getCharactersForFollowerAssignment,
  getExplorationSchemaSupport,
  saveExplorationLocationNote,
} from "./followerService";

const emptyLocation = {
  code: "",
  zoneNumber: 1,
  name: "",
  shortName: "",
  category: "",
  summary: "",
  tags: "",
  baseSuccessPercent: 60,
  active: true,
  sortOrder: 0,
  mapLabel: "",
  selfCharacterIds: [],
  adminNote: "",
};
const LOCATION_PAGE_SIZE = 8;

function locationToForm(location) {
  return {
    code: location.code || "",
    zoneNumber: location.zone_number || 1,
    name: location.name || "",
    shortName: location.short_name || "",
    category: location.category || "",
    summary: location.summary || "",
    tags: (location.tags || []).join(", "),
    baseSuccessPercent: location.base_success_percent ?? 60,
    active: location.active !== false,
    sortOrder: location.sort_order || 0,
    mapLabel: location.map_label || PALACE_LOCATIONS.find((point) => point.code === location.code)?.label || "",
    selfCharacterIds: location.self_character_ids || [],
    adminNote: location.admin_note || "",
  };
}

function splitTags(value) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag, index, tags) => tag && tags.indexOf(tag) === index);
}

export function FollowerLocationManager() {
  const [locations, setLocations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyLocation);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [characters, setCharacters] = useState([]);
  const [supportsMap, setSupportsMap] = useState(null);
  const [schemaChecking, setSchemaChecking] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [page, setPage] = useState(1);
  const [editorTab, setEditorTab] = useState("info");
  const [showMap, setShowMap] = useState(false);
  const [notesReady, setNotesReady] = useState(true);

  const checkSchema = useCallback(async () => {
    setSchemaChecking(true);
    const support = await getExplorationSchemaSupport();
    if (support.error) {
      setSupportsMap(null);
      setError("ตรวจสอบระบบพื้นที่ไม่สำเร็จ กรุณาลองใหม่");
    } else {
      setSupportsMap(support.supported);
    }
    setSchemaChecking(false);
  }, []);

  function downloadSetup() {
    const blob = new Blob([schemaSQL, '\n', seedSQL, '\n', quotaSQL, '\n', notesSQL, '\n', playerOutcomeSQL, '\n', playerDropSQL, '\n', backfillDropSQL, "\nNOTIFY pgrst, 'reload schema';\n"], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "install-map-exploration.sql";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  useEffect(() => {
    let alive = true;
    getCharactersForFollowerAssignment().then((people) => {
      if (!alive) return;
      setCharacters(people.data || []);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void checkSchema(); }, 0);
    return () => clearTimeout(timer);
  }, [checkSchema]);


  function selectMapPoint(label) {
    setShowMap(false);
    setSearch("");
    setStatusFilter("all");
    setEditorTab("info");
    const point = PALACE_LOCATIONS.find((entry) => entry.label === label);
    const existing = locations.find((entry) => entry.map_label === label || entry.code === point.code);
    if (existing) {
      setPage(Math.floor(locations.findIndex((location) => location.id === existing.id) / LOCATION_PAGE_SIZE) + 1);
      selectLocation(existing);
      setForm((current) => ({ ...current, mapLabel: label }));
    } else {
      const usedZones = new Set(locations.map((entry) => entry.zone_number));
      const zone = Array.from({ length: 99 }, (_, index) => index + 1).find((number) => !usedZones.has(number));
      setSelectedId(null);
      setForm({ ...emptyLocation, code: point.code, name: point.name, shortName: point.name,
        category: point.category, summary: point.summary, mapLabel: label, zoneNumber: zone || 99,
        sortOrder: PALACE_LOCATIONS.indexOf(point), active: false });
      setError("");
    }
  }

  const loadLocations = useCallback(async (preferredId) => {
    setLoading(true);
    const { data, error: loadError, notesError } = await getAllExplorationLocations();
    setLoading(false);
    if (loadError) {
      setLocations([]);
      setError("โหลดโลเคชั่นไม่สำเร็จ");
      return;
    }
    const mapOrder = new Map(PALACE_LOCATIONS.map((point, index) => [point.label, index]));
    const orderedLocations = [...(data || [])].sort((left, right) => {
      const leftOrder = mapOrder.get(left.map_label) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = mapOrder.get(right.map_label) ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder || left.sort_order - right.sort_order;
    });
    setLocations(orderedLocations);
    setNotesReady(!notesError);
    const target =
      orderedLocations.find((location) => location.id === preferredId) ||
      orderedLocations[0] ||
      null;
    setSelectedId(target?.id || null);
    setForm(target ? locationToForm(target) : emptyLocation);
    setError(notesError ? "ยังโหลดโน้ตไม่ได้ กรุณาติดตั้ง SQL โน้ตสำหรับแอดมินก่อนบันทึก" : "");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadLocations, 0);
    return () => window.clearTimeout(timer);
  }, [loadLocations]);

  const activeCount = useMemo(
    () => locations.filter((location) => location.active).length,
    [locations],
  );
  const filteredLocations = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("th");
    return locations.filter((location) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && location.active) ||
        (statusFilter === "inactive" && !location.active);
      const text = [
        location.name,
        location.short_name,
        location.category,
        location.code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("th");
      return matchesStatus && (!keyword || text.includes(keyword));
    });
  }, [locations, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLocations.length / LOCATION_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageLocations = filteredLocations.slice((currentPage - 1) * LOCATION_PAGE_SIZE, currentPage * LOCATION_PAGE_SIZE);

  function selectLocation(location) {
    setSaveMessage("");
    setSelectedId(location.id);
    setForm(locationToForm(location));
    setError("");
  }

  function startCreate() {
    setEditorTab("info");
    setSaveMessage("");
    const nextZone = Math.max(0, ...locations.map((item) => item.zone_number)) + 1;
    const nextOrder = Math.max(0, ...locations.map((item) => item.sort_order)) + 1;
    setSelectedId(null);
    setForm({
      ...emptyLocation,
      zoneNumber: nextZone,
      sortOrder: nextOrder,
    });
    setError("");
  }

  function update(key, value) {
    setSaveMessage("");
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (supportsMap === null || schemaChecking) return;
    if (!notesReady) {
      setError("ยังบันทึกโน้ตไม่ได้ กรุณาติดตั้ง SQL โน้ตสำหรับแอดมินก่อน");
      return;
    }
    if (!form.name.trim() || !form.shortName.trim() || !form.category.trim()) {
      setEditorTab("info");
      setError("กรุณากรอกชื่อย่อ ชื่อเต็ม และหมวดหมู่ให้ครบ");
      return;
    }
    if (!form.code.trim() || !Number.isInteger(Number(form.zoneNumber)) || Number(form.zoneNumber) < 1 || Number(form.zoneNumber) > 99 ||
      !Number.isInteger(Number(form.baseSuccessPercent)) || Number(form.baseSuccessPercent) < 5 || Number(form.baseSuccessPercent) > 95 ||
      form.sortOrder === "" || !Number.isInteger(Number(form.sortOrder)) || Number(form.sortOrder) < 0) {
      setEditorTab("rules");
      setError("กรุณาตรวจรหัสระบบ เขต 1–99 ลำดับตั้งแต่ 0 และโอกาสสำเร็จ 5–95%");
      return;
    }
    setSaving(true);
    setError("");
    const values = {
      ...form,
      code: form.code.trim().toLocaleLowerCase("en").replace(/\s+/g, "_"),
      name: form.name.trim(),
      shortName: form.shortName.trim(),
      category: form.category.trim(),
      summary: form.summary.trim(),
      tags: splitTags(form.tags),
      zoneNumber: Number(form.zoneNumber),
      baseSuccessPercent: Number(form.baseSuccessPercent),
      sortOrder: Number(form.sortOrder),
    };
    const result = selectedId
      ? await updateExplorationLocation(selectedId, values, supportsMap)
      : await createExplorationLocation(values, supportsMap);
    if (result.error) {
      setSaving(false);
      if (isMissingMapSchema(result.error)) {
        setSupportsMap(false);
        setError("ฐานข้อมูลยังไม่พร้อมสำหรับสิทธิ์สำรวจใหม่ กรุณาติดตั้งตามขั้นตอนด้านบน ข้อมูลที่กรอกยังอยู่");
        return;
      }
      setError(
        result.error.code === "23505"
          ? "รหัสหรือหมายเลขเขตซ้ำกับโลเคชั่นอื่น"
          : result.error.message || "บันทึกโลเคชั่นไม่สำเร็จ",
      );
      return;
    }
    const noteResult = await saveExplorationLocationNote(result.data.id, form.adminNote.trim());
    if (noteResult.error) {
      setSelectedId(result.data.id);
      setError("บันทึกข้อมูลพื้นที่แล้ว แต่บันทึกโน้ตไม่สำเร็จ กรุณาลองบันทึกอีกครั้ง: " + noteResult.error.message);
      setSaving(false);
      return;
    }
    await loadLocations(result.data.id);
    setSaving(false);
    setSaveMessage(supportsMap ? "บันทึกโลเคชั่นแล้ว" : "บันทึกข้อมูลพื้นที่แล้ว ส่วนสิทธิ์ไปเองต้องติดตั้งระบบก่อน");
  }

  return (
    <div className="map-location-admin">
      <div className="map-round-toolbar">
        <div><strong>แผนที่และสิทธิ์สำรวจ</strong><p>เลือกจุดบนภาพเพื่อตั้งค่าพื้นที่ เปิดสิทธิ์ไปเองเป็นรายตัวละคร ผู้ติดตามใช้สิทธิ์ในทะเบียนของตน</p></div>
        <div className="map-round-actions">
        <button type="button" aria-expanded={showMap} onClick={() => setShowMap(!showMap)}><MapPin size={14} /> {showMap ? "ซ่อนแผนที่" : "เลือกจากแผนที่"}</button>
        </div>
      </div>
      {showMap && <PalaceMap selectedLabel={form.mapLabel} onSelect={selectMapPoint}
        availableLabels={locations.filter((location) => location.active).map((location) => location.map_label)} />}
      {supportsMap === false && <div className="map-setup-notice" role="status">
        <strong>ข้อมูลพื้นที่บันทึกได้ — สิทธิ์สำรวจใหม่ยังไม่ได้ติดตั้ง</strong>
        <p>ดาวน์โหลด SQL แล้วเปิด Supabase → SQL Editor ของโปรเจกต์นี้ วางและรันหนึ่งครั้ง จากนั้นกดตรวจสอบอีกครั้ง เพื่อเปิดการผูกจุดและสิทธิ์ไปเอง</p>
        <button type="button" onClick={downloadSetup}>ดาวน์โหลด SQL ติดตั้ง</button>
        <button type="button" disabled={schemaChecking} onClick={checkSchema}>{schemaChecking ? "กำลังตรวจสอบ…" : "ตรวจสอบอีกครั้ง"}</button>
      </div>}
      {!notesReady && <div className="map-setup-notice" role="status"><strong>ยังไม่ติดตั้งช่องโน้ตแอดมิน</strong><p>รันไฟล์ public/setup/add-exploration-location-notes.sql ใน Supabase SQL Editor แล้วโหลดหน้านี้ใหม่</p></div>}
      {supportsMap === null && <div className="map-setup-notice"><span>{schemaChecking ? "กำลังตรวจสอบระบบพื้นที่…" : "ตรวจสอบการเชื่อมต่อก่อนบันทึก"}</span><button type="button" disabled={schemaChecking} onClick={checkSchema}>ลองอีกครั้ง</button></div>}
    <div className="location-workspace">
      <aside className="location-directory">
        <header>
          <div>
            <h2>พื้นที่สำรวจ</h2>
            <p>{locations.length} พื้นที่ · เปิดใช้งาน {activeCount}</p>
          </div>
          <button type="button" onClick={startCreate}>
            <Plus size={14} /> เพิ่มพื้นที่
          </button>
        </header>
        <div className="location-directory-tools">
          <div className="search-box">
            <Search size={16} />
            <input
              type="search"
              value={search}
              placeholder="ค้นหาพื้นที่"
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            />
          </div>
          <select
            value={statusFilter}
            aria-label="กรองสถานะพื้นที่"
            onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}
          >
            <option value="all">ทุกสถานะ</option>
            <option value="active">เปิดใช้งาน</option>
            <option value="inactive">ปิดใช้งาน</option>
          </select>
        </div>
        <div className="location-list">
          {loading ? (
            <p>กำลังโหลดโลเคชั่น...</p>
          ) : filteredLocations.length ? (
            pageLocations.map((location) => (
              <button
                type="button"
                key={location.id}
                className={selectedId === location.id ? "selected" : ""}
                onClick={() => selectLocation(location)}
              >
                <span className="location-zone">{location.map_label || location.zone_number}</span>
                <span>
                  <strong>{location.short_name}</strong>
                  <small>{location.category}</small>
                </span>
                <em className={location.active ? "active" : "inactive"}>
                  {location.active ? "เปิด" : "ปิด"}
                </em>
              </button>
            ))
          ) : (
            <div className="mission-empty location-empty">
              <MapPin size={24} />
              <strong>{locations.length ? "ไม่พบพื้นที่ที่ค้นหา" : "ยังไม่มีพื้นที่สำรวจ"}</strong>
              <span>{locations.length ? "ลองเปลี่ยนคำค้นหาหรือสถานะ" : "เริ่มสร้างพื้นที่แรกสำหรับภารกิจสำรวจ"}</span>
              {!locations.length && (
                <button type="button" onClick={startCreate}>
                  <Plus size={14} /> สร้างพื้นที่แรก
                </button>
              )}
            </div>
          )}
        </div>
        <footer className="location-directory-footer">
          <span>{filteredLocations.length ? `${(currentPage - 1) * LOCATION_PAGE_SIZE + 1}–${Math.min(currentPage * LOCATION_PAGE_SIZE, filteredLocations.length)} จาก ${filteredLocations.length} พื้นที่` : "0 พื้นที่"}</span>
          <ListPagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} label="หน้ารายการพื้นที่สำรวจ" />
        </footer>
      </aside>

      <section className="location-editor">
        <header>
          <div>
            <span>{selectedId ? "แก้ไขโลเคชั่น" : "สร้างโลเคชั่นใหม่"}</span>
            <h2>{form.shortName || "พื้นที่สำรวจใหม่"}</h2>
            <p>{selectedId ? `เขต ${form.zoneNumber} · ${form.code}` : "กำหนดข้อมูลที่ผู้เล่นเห็นและกติกาการสำรวจ"}</p>
          </div>
          <div className="location-chance-preview">
            <span>โอกาสพื้นฐาน</span>
            <strong>{form.baseSuccessPercent || 0}%</strong>
          </div>
        </header>

        <nav className="location-editor-tabs" aria-label="ส่วนของฟอร์มพื้นที่">
          {[["info", "ข้อมูลพื้นที่"], ["rules", "กติกา"], ["access", `สิทธิ์เข้าถึง (${form.selfCharacterIds.length})`]].map(([id, label]) =>
            <button key={id} type="button" aria-pressed={editorTab === id} onClick={() => setEditorTab(id)}>{label}</button>)}
        </nav>
        <form onSubmit={submit}>
          <div className="location-editor-body">
          {editorTab === "info" && <section className="location-form-section">
            <header>
              <div><strong>ข้อมูลที่ผู้เล่นเห็น</strong><span>ชื่อและคำอธิบายที่ปรากฏในหน้าสำรวจ</span></div>
            </header>
            <div className="location-form-grid">
              <label>
                ชื่อย่อ
                <input
                  required
                  value={form.shortName}
                  placeholder="เช่น กองโอสถ"
                  onChange={(event) => update("shortName", event.target.value)}
                />
              </label>
              <label>
                ชื่อเต็ม
                <input
                  required
                  value={form.name}
                  placeholder="ชื่อเต็มของสถานที่"
                  onChange={(event) => update("name", event.target.value)}
                />
              </label>
              <label>
                หมวดหมู่
                <input
                  required
                  value={form.category}
                  placeholder="เช่น กองงาน, เขตพระราชฐาน"
                  onChange={(event) => update("category", event.target.value)}
                />
              </label>
            </div>
            <label>
              คำอธิบายพื้นที่ (ผู้เล่นเห็น)
              <textarea
                rows="3"
                value={form.summary}
                placeholder="บรรยากาศ หน้าที่ของพื้นที่ และสิ่งที่อาจค้นพบ"
                onChange={(event) => update("summary", event.target.value)}
              />
            </label>
            <label>
              โน้ตสำหรับแอดมิน (ผู้เล่นไม่เห็น)
              <textarea
                rows="4"
                value={form.adminNote}
                placeholder="เช่น เปิดวันศุกร์ 18:00–22:00 / เปิดให้ตัวละครกลุ่มใด / เหตุผลที่ปิดพื้นที่"
                onChange={(event) => update("adminNote", event.target.value)}
              />
              <small>บันทึกไว้เตือนทีมงาน ผู้เล่นจะไม่เห็นข้อความนี้</small>
            </label>
          </section>}

          {editorTab === "rules" && <section className="location-form-section">
            <header>
              <div><strong>กติกาและระบบ</strong><span>รหัส การเรียงลำดับ และโอกาสสำเร็จพื้นฐาน</span></div>
            </header>
            <div className="location-form-grid system-grid">
              <label>จุดบนแผนที่
                <select disabled={!supportsMap} value={form.mapLabel} onChange={(event) => update("mapLabel", event.target.value)}>
                  <option value="">ยังไม่ผูกจุด</option>
                  {PALACE_LOCATIONS.map((point) => <option key={point.label} value={point.label}>{point.label} · {point.name}</option>)}
                </select>
              </label>
              <label>
                รหัสระบบ
                <input
                  required
                  value={form.code}
                  placeholder="medical_bureau"
                  onChange={(event) => update("code", event.target.value)}
                />
              </label>
              <label>
                หมายเลขเขต
                <input
                  type="number"
                  min="1"
                  max="99"
                  required
                  value={form.zoneNumber}
                  onChange={(event) => update("zoneNumber", event.target.value)}
                />
              </label>
              <label>
                ลำดับแสดง
                <input
                  type="number"
                  min="0"
                  value={form.sortOrder}
                  onChange={(event) => update("sortOrder", event.target.value)}
                />
              </label>
              <label>
                โอกาสสำเร็จพื้นฐาน
                <div className="location-percent-input">
                  <input
                    type="number"
                    min="5"
                    max="95"
                    required
                    value={form.baseSuccessPercent}
                    onChange={(event) => update("baseSuccessPercent", event.target.value)}
                  />
                  <span>%</span>
                </div>
                <small>ระบบสุ่มสำเร็จ/ไม่สำเร็จเมื่อผู้เล่นกดสำรวจ · Talent ปรับตามสัดส่วนของค่าพื้นฐาน เช่น 50% กับ Talent +40% = 70%</small>
              </label>
            </div>
            <label>
              Tag ที่จับคู่กับ Talent
              <input
                value={form.tags}
                placeholder="สมุนไพร, การแพทย์, ยา, ข่าว"
                onChange={(event) => update("tags", event.target.value)}
              />
              <small>คั่นแต่ละ Tag ด้วยเครื่องหมายจุลภาค</small>
            </label>
          </section>}

          {editorTab === "access" && <>
          <label className="location-availability">
            <span>
              <strong>เปิดให้ส่งสำรวจ</strong>
              <small>เมื่อปิด ผู้เล่นจะไม่เห็นพื้นที่นี้ในภารกิจใหม่</small>
            </span>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => update("active", event.target.checked)}
            />
            <i aria-hidden="true" />
          </label>

          <section className="location-form-section">
            <header><div><strong>ตัวละครที่ไปเองได้</strong><span>ให้สิทธิ์เฉพาะพื้นที่นี้ ไม่มีรายชื่อ = ไปเองไม่ได้</span></div></header>
            {supportsMap ? <CharacterAccessPicker key={selectedId || form.mapLabel || "new"}
              characters={characters} selectedIds={form.selfCharacterIds}
              onChange={(ids) => update("selfCharacterIds", ids)} />
              : <p className="map-setup-hint">ติดตั้งระบบสำรวจจากขั้นตอนด้านบนก่อนกำหนดสิทธิ์ตัวละคร</p>}
          </section>
          </>}
          </div>

          <div className="location-actions">
            <div className="location-save-status" aria-live="polite">
              {error ? <p className="follower-form-error">{error}</p> : saveMessage ? <p className="map-save-message">{saveMessage}</p> : <span>บันทึกข้อมูลทุกแท็บพร้อมกัน</span>}
            </div>
            <button
              type="submit"
              className="primary-button"
              disabled={
                saving ||
                supportsMap === null || schemaChecking ||
                loading
              }
            >
              <Save size={15} />
              {saving ? "กำลังบันทึก..." : "บันทึกโลเคชั่น"}
            </button>
          </div>
        </form>
      </section>
    </div>
    </div>
  );
}
