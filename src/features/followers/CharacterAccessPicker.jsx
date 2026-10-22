import { useMemo, useState } from "react";
import { ListPagination } from "../../components/ui/ListPagination";

const PAGE_SIZE = 10;

export function CharacterAccessPicker({ characters, selectedIds, onChange }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const matches = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("th");
    return characters.filter((character) => {
      const text = `${character.character_name || ""} ${character.player_name || ""}`.toLocaleLowerCase("th");
      return (!keyword || text.includes(keyword)) &&
        (filter === "all" || (filter === "selected" ? selected.has(character.id) : !selected.has(character.id)));
    });
  }, [characters, search, filter, selected]);
  const totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = matches.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function toggle(id, checked) {
    onChange(checked ? [...new Set([...selectedIds, id])] : selectedIds.filter((value) => value !== id));
  }

  function changeMatching(checked) {
    const matchingIds = new Set(matches.map((character) => character.id));
    onChange(checked ? [...new Set([...selectedIds, ...matchingIds])] : selectedIds.filter((id) => !matchingIds.has(id)));
  }

  return (
    <div className="character-access-picker">
      <div className="access-picker-summary"><strong>เลือกแล้ว {selectedIds.length} คน</strong><span>จากตัวละคร {characters.length} คน · บันทึกพร้อมโลเคชั่น</span></div>
      <div className="access-picker-tools">
        <input type="search" aria-label="ค้นหาตัวละครที่ให้สิทธิ์" placeholder="ค้นหาชื่อตัวละคร / ชื่อผู้เล่น"
          value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        <select aria-label="กรองสิทธิ์ตัวละคร" value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }}>
          <option value="all">ทั้งหมด</option><option value="selected">เลือกแล้ว</option><option value="unselected">ยังไม่เลือก</option>
        </select>
      </div>
      <div className="access-picker-bulk">
        <span>พบ {matches.length} คน</span>
        <button type="button" disabled={!matches.some((character) => !selected.has(character.id))} onClick={() => changeMatching(true)}>เลือกผลลัพธ์ทั้งหมด ({matches.length})</button>
        <button type="button" disabled={!matches.some((character) => selected.has(character.id))} onClick={() => changeMatching(false)}>ยกเลิกเฉพาะผลลัพธ์</button>
      </div>
      <div className="access-picker-list">
        {visible.map((character) => <label className="access-picker-row" key={character.id}>
          <input type="checkbox" checked={selected.has(character.id)} onChange={(event) => toggle(character.id, event.target.checked)} />
          <span className="access-picker-name"><strong>{character.character_name}</strong><small>{character.player_name || "ยังไม่ระบุชื่อผู้เล่น"}</small></span>
          <span className="access-picker-state">{selected.has(character.id) ? "ให้สิทธิ์" : "—"}</span>
        </label>)}
        {!visible.length && <p className="access-picker-empty">{!characters.length ? "ยังไม่มีตัวละครให้กำหนดสิทธิ์" : "ไม่พบตัวละครตามตัวกรองนี้"}</p>}
      </div>
      <div className="access-picker-footer">
        <span>{matches.length ? `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, matches.length)} จาก ${matches.length} คน` : "0 คน"}</span>
        <ListPagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} label="หน้ารายการสิทธิ์ตัวละคร" />
      </div>
    </div>
  );
}
