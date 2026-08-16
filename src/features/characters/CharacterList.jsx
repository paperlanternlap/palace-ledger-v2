import { ChevronRight, Search } from "lucide-react";

export function CharacterList({
  characters,
  selectedId,
  onSelect,
  loading,
}) {
  if (loading) {
    return (
      <div className="character-list" aria-label="กำลังโหลดรายชื่อตัวละคร">
        {[1, 2, 3, 4].map((item) => (
          <div className="character-skeleton" key={item} />
        ))}
      </div>
    );
  }

  if (!characters.length) {
    return (
      <div className="list-empty">
        <Search size={22} />
        <strong>ไม่พบตัวละคร</strong>
        <span>ลองเปลี่ยนคำค้นหา หรือเพิ่มตัวละครใหม่</span>
      </div>
    );
  }

  return (
    <div className="character-list">
      {characters.map((character) => (
        <button
          type="button"
          key={character.id}
          onClick={() => onSelect(character)}
          className={`character-row ${
            selectedId === character.id ? "selected" : ""
          }`}
        >
          {character.avatar_url ? (
            <img
              src={character.avatar_url}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="avatar-fallback">
              {(character.character_name || "?").slice(0, 1)}
            </div>
          )}
          <span className="character-summary">
            <strong>{character.character_name || "ยังไม่มีชื่อ"}</strong>
            <span>
              {[character.role, character.position].filter(Boolean).join(" · ") ||
                character.player_name ||
                "ยังไม่ระบุประเภทและตำแหน่ง"}
            </span>
          </span>
          <ChevronRight size={17} className="row-chevron" />
        </button>
      ))}
    </div>
  );
}
