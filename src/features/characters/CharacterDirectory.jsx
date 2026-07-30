import { Search, X } from "lucide-react";
import {
  ListPagination,
} from "../../components/ui/ListPagination";
import { useListPagination } from "../../components/ui/useListPagination";
import { CharacterList } from "./CharacterList";
import { formatNumber } from "./utils";

export function CharacterDirectory({
  characters,
  selectedId,
  search,
  roleFilter,
  positionFilter,
  roleOptions,
  positionOptions,
  loading,
  onSelect,
  onSearchChange,
  onRoleFilterChange,
  onPositionFilterChange,
}) {
  const characterPages = useListPagination(
    characters,
    6,
    `${search}|${roleFilter}|${positionFilter}`,
  );

  return (
    <aside className="directory-panel">
      <div className="directory-head">
        <div>
          <h2>รายชื่อตัวละคร</h2>
          <span>{formatNumber(characters.length)} คน</span>
        </div>

        <div className="search-box">
          <Search size={17} />
          <input
            type="search"
            placeholder="ค้นหาตัวละครหรือผู้เล่น"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            aria-label="ค้นหาตัวละครหรือผู้เล่น"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="ล้างคำค้นหา"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="character-attribute-filters">
          <label>
            <span>ประเภทตัวละคร</span>
            <select
              value={roleFilter}
              onChange={(event) => onRoleFilterChange(event.target.value)}
            >
              <option value="all">ทุกประเภท</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </label>
          <label>
            <span>ยศ / ตำแหน่ง</span>
            <select
              value={positionFilter}
              onChange={(event) => onPositionFilterChange(event.target.value)}
            >
              <option value="all">ทุกตำแหน่ง</option>
              {positionOptions.map((position) => (
                <option key={position} value={position}>{position}</option>
              ))}
            </select>
          </label>
        </div>

      </div>

      <CharacterList
        characters={characterPages.pageItems}
        selectedId={selectedId}
        onSelect={onSelect}
        loading={loading}
      />
      <ListPagination
        currentPage={characterPages.currentPage}
        totalPages={characterPages.totalPages}
        onPageChange={characterPages.setPage}
        label="หน้ารายชื่อตัวละคร"
      />
    </aside>
  );
}
