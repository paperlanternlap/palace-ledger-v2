import { Search, X } from "lucide-react";
import { CharacterList } from "./CharacterList";
import { STATUS_OPTIONS } from "./constants";
import { formatNumber } from "./utils";

export function CharacterDirectory({
  characters,
  selectedId,
  selectedStatus,
  search,
  loading,
  onSelect,
  onStatusChange,
  onSearchChange,
}) {
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

        <div className="status-filters" aria-label="กรองตามสถานะ">
          {STATUS_OPTIONS.map((status) => (
            <button
              type="button"
              key={status}
              className={selectedStatus === status ? "selected" : ""}
              onClick={() => onStatusChange(status)}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <CharacterList
        characters={characters}
        selectedId={selectedId}
        onSelect={onSelect}
        loading={loading}
      />
    </aside>
  );
}
