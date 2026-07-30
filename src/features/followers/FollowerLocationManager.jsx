import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPin, Plus, Save } from "lucide-react";
import {
  createExplorationLocation,
  getAllExplorationLocations,
  updateExplorationLocation,
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
};

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

  const loadLocations = useCallback(async (preferredId) => {
    setLoading(true);
    const { data, error: loadError } = await getAllExplorationLocations();
    setLoading(false);
    if (loadError) {
      setLocations([]);
      setError("โหลดโลเคชั่นไม่สำเร็จ");
      return;
    }
    setLocations(data || []);
    const target =
      (data || []).find((location) => location.id === preferredId) ||
      data?.[0] ||
      null;
    setSelectedId(target?.id || null);
    setForm(target ? locationToForm(target) : emptyLocation);
    setError("");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadLocations, 0);
    return () => window.clearTimeout(timer);
  }, [loadLocations]);

  const activeCount = useMemo(
    () => locations.filter((location) => location.active).length,
    [locations],
  );

  function selectLocation(location) {
    setSelectedId(location.id);
    setForm(locationToForm(location));
    setError("");
  }

  function startCreate() {
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
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
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
      ? await updateExplorationLocation(selectedId, values)
      : await createExplorationLocation(values);
    setSaving(false);
    if (result.error) {
      setError(
        result.error.code === "23505"
          ? "รหัสหรือหมายเลขเขตซ้ำกับโลเคชั่นอื่น"
          : result.error.message || "บันทึกโลเคชั่นไม่สำเร็จ",
      );
      return;
    }
    await loadLocations(result.data.id);
  }

  return (
    <div className="location-workspace">
      <aside className="location-directory">
        <header>
          <div>
            <span>โลเคชั่นทั้งหมด</span>
            <strong>{locations.length}</strong>
            <small>เปิดใช้ {activeCount}</small>
          </div>
          <button type="button" onClick={startCreate}>
            <Plus size={14} /> เพิ่มพื้นที่
          </button>
        </header>
        <div className="location-list">
          {loading ? (
            <p>กำลังโหลดโลเคชั่น...</p>
          ) : locations.length ? (
            locations.map((location) => (
              <button
                type="button"
                key={location.id}
                className={selectedId === location.id ? "selected" : ""}
                onClick={() => selectLocation(location)}
              >
                <span className="location-zone">{location.zone_number}</span>
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
            <div className="mission-empty">
              <MapPin size={24} />
              <strong>ยังไม่มีโลเคชั่น</strong>
            </div>
          )}
        </div>
      </aside>

      <section className="location-editor">
        <header>
          <div>
            <span>{selectedId ? "แก้ไขโลเคชั่น" : "สร้างโลเคชั่นใหม่"}</span>
            <h2>{form.shortName || "พื้นที่สำรวจใหม่"}</h2>
          </div>
          <div className="location-chance-preview">
            <span>โอกาสพื้นฐาน</span>
            <strong>{form.baseSuccessPercent || 0}%</strong>
          </div>
        </header>

        <form onSubmit={submit}>
          <div className="location-form-grid three">
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
              รหัสระบบ
              <input
                required
                value={form.code}
                placeholder="medical_bureau"
                onChange={(event) => update("code", event.target.value)}
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
          </div>

          <div className="location-form-grid">
            <label>
              ชื่อเต็ม
              <input
                required
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
              />
            </label>
            <label>
              ชื่อย่อ
              <input
                required
                value={form.shortName}
                onChange={(event) => update("shortName", event.target.value)}
              />
            </label>
          </div>

          <div className="location-form-grid">
            <label>
              หมวดหมู่
              <input
                required
                value={form.category}
                placeholder="เช่น กองโอสถ"
                onChange={(event) => update("category", event.target.value)}
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
                  onChange={(event) =>
                    update("baseSuccessPercent", event.target.value)
                  }
                />
                <span>%</span>
              </div>
            </label>
          </div>

          <label>
            คำอธิบายพื้นที่
            <textarea
              rows="3"
              value={form.summary}
              onChange={(event) => update("summary", event.target.value)}
            />
          </label>

          <label>
            Tag ที่จับคู่กับ Talent
            <input
              value={form.tags}
              placeholder="สมุนไพร, การแพทย์, ยา, ข่าว"
              onChange={(event) => update("tags", event.target.value)}
            />
            <small>คั่นด้วยเครื่องหมายจุลภาค</small>
          </label>

          <label className="stock-toggle">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => update("active", event.target.checked)}
            />
            <span>
              <strong>เปิดให้ส่งสำรวจ</strong>
              <small>เมื่อปิด ผู้เล่นจะไม่เห็นพื้นที่นี้ในภารกิจใหม่</small>
            </span>
          </label>

          {error && <p className="follower-form-error">{error}</p>}
          <div className="location-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={
                saving ||
                !form.code.trim() ||
                !form.name.trim() ||
                !form.shortName.trim() ||
                !form.category.trim()
              }
            >
              <Save size={15} />
              {saving ? "กำลังบันทึก..." : "บันทึกโลเคชั่น"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
