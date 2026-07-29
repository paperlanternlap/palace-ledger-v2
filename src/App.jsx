import { useCallback, useEffect, useMemo, useState } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { AdjustmentModal } from "./features/characters/AdjustmentModal";
import { CharacterDetail } from "./features/characters/CharacterDetail";
import { CharacterDirectory } from "./features/characters/CharacterDirectory";
import {
  addHistory,
  getCharacterDetails,
  getCharacters,
  updateScore,
} from "./features/characters/characterService";
import {
  filterCharacters,
  formatNumber,
} from "./features/characters/utils";

function App() {
  const [characters, setCharacters] = useState([]);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState("ทั้งหมด");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const loadCharacters = useCallback(async (preferredId) => {
    setLoading(true);
    const { data, error } = await getCharacters();

    if (error) {
      setNotice({ type: "error", message: "โหลดข้อมูลตัวละครไม่สำเร็จ" });
    } else {
      const nextCharacters = data || [];
      setCharacters(nextCharacters);

      const freshCharacter = nextCharacters.find(
        (item) => item.id === preferredId,
      );
      if (freshCharacter) setSelectedCharacter(freshCharacter);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => loadCharacters(), 0);
    return () => window.clearTimeout(timer);
  }, [loadCharacters]);

  async function selectCharacter(character) {
    setSelectedCharacter(character);
    setInventory([]);
    setHistory([]);
    setDetailLoading(true);

    const results = await getCharacterDetails(character.id);
    if (results.inventory.error || results.history.error) {
      setNotice({ type: "error", message: "โหลดรายละเอียดบางส่วนไม่สำเร็จ" });
    }
    setInventory(results.inventory.data || []);
    setHistory(results.history.data || []);
    setDetailLoading(false);
  }

  async function submitAdjustment({ amount, note }) {
    if (!selectedCharacter || amount <= 0 || !note) return;
    setSubmitting(true);

    const field = adjustmentType === "rp" ? "rp" : "favor";
    const currentValue = Number(selectedCharacter[field]) || 0;
    const nextValue = currentValue + amount;
    const label = adjustmentType === "rp" ? "RP" : "Favor";
    const action =
      adjustmentType === "rp" ? `เพิ่ม RP · ${note}` : `เพิ่มความโปรดปราน · ${note}`;

    const { error } = await updateScore({
      characterId: selectedCharacter.id,
      field,
      currentValue,
      nextValue,
    });

    if (error) {
      setNotice({ type: "error", message: "บันทึกคะแนนไม่สำเร็จ กรุณาลองอีกครั้ง" });
      setSubmitting(false);
      return;
    }

    const historyResult = await addHistory({
      character_id: selectedCharacter.id,
      action,
      value: `+${formatNumber(amount)} ${label}`,
      type: adjustmentType,
    });

    const updatedCharacter = { ...selectedCharacter, [field]: nextValue };
    setAdjustmentType(null);
    setSubmitting(false);
    setNotice({
      type: historyResult.error ? "warning" : "success",
      message: historyResult.error
        ? "เพิ่มคะแนนแล้ว แต่บันทึกประวัติไม่สำเร็จ"
        : "เพิ่มคะแนนและบันทึกประวัติเรียบร้อย",
    });
    await loadCharacters(selectedCharacter.id);
    await selectCharacter(updatedCharacter);
  }

  const filteredCharacters = useMemo(
    () => filterCharacters(characters, selectedStatus, search),
    [characters, search, selectedStatus],
  );

  return (
    <div className="app-shell h-screen min-h-0 overflow-hidden">
      <Sidebar />

      <main className="main-content flex h-screen min-h-0 flex-col overflow-hidden">
        <header className="page-header flex h-9 shrink-0 items-center justify-between">
          <h1 className="!text-lg !leading-none">จัดการตัวละคร</h1>
          <button
            type="button"
            className="primary-button !min-h-8 !px-3 !text-xs"
            disabled
          >
            + เพิ่มตัวละคร
          </button>
        </header>

        <section className="workspace min-h-0 flex-1">
          <CharacterDirectory
            characters={filteredCharacters}
            selectedId={selectedCharacter?.id}
            selectedStatus={selectedStatus}
            search={search}
            loading={loading}
            onSelect={selectCharacter}
            onStatusChange={setSelectedStatus}
            onSearchChange={setSearch}
          />
          <CharacterDetail
            character={selectedCharacter}
            inventory={inventory}
            history={history}
            loading={detailLoading}
            onAdjust={setAdjustmentType}
          />
        </section>
      </main>

      {adjustmentType && selectedCharacter && (
        <AdjustmentModal
          type={adjustmentType}
          character={selectedCharacter}
          submitting={submitting}
          onClose={() => setAdjustmentType(null)}
          onSubmit={submitAdjustment}
        />
      )}

      {notice && (
        <div className={`toast ${notice.type}`} role="status">
          {notice.message}
        </div>
      )}
    </div>
  );
}

export default App;
