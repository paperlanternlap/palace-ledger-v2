import { useCallback, useEffect, useMemo, useState } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { StaffGate } from "./features/auth/StaffGate";
import { AdjustmentModal } from "./features/characters/AdjustmentModal";
import { CharacterDetail } from "./features/characters/CharacterDetail";
import { CharacterDirectory } from "./features/characters/CharacterDirectory";
import { GrantItemModal } from "./features/characters/GrantItemModal";
import { CreateCharacterModal } from "./features/characters/CreateCharacterModal";
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
import { InventoryManager } from "./features/inventory/InventoryManager";
import { ItemRequestQueue } from "./features/item-requests/ItemRequestQueue";
import { FollowerManager } from "./features/followers/FollowerManager";
import { FollowerMissionQueue } from "./features/followers/FollowerMissionQueue";
import { RpQueue } from "./features/rp-queue/RpQueue";
import { StaffOverview } from "./features/overview/StaffOverview";
import { signOut } from "./features/auth/authService";
import {
  CHARACTER_ROLE_OPTIONS,
  getPositionOptions,
} from "./features/characters/rankOptions";

function StaffApp() {
  const [activePage, setActivePage] = useState("dashboard");
  const [characters, setCharacters] = useState([]);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState(null);
  const [showGrantItem, setShowGrantItem] = useState(false);
  const [showCreateCharacter, setShowCreateCharacter] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

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
    () => filterCharacters(characters, search, roleFilter, positionFilter),
    [characters, positionFilter, roleFilter, search],
  );
  const characterRoleOptions = useMemo(
    () => [
      ...new Set([
        ...CHARACTER_ROLE_OPTIONS,
        ...characters.map((character) => character.role).filter(Boolean),
      ]),
    ],
    [characters],
  );
  const characterPositionOptions = useMemo(
    () => getPositionOptions(roleFilter, characters),
    [characters, roleFilter],
  );

  return (
    <div className="app-shell h-screen min-h-0 overflow-hidden">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        loggingOut={loggingOut}
        onSignOut={async () => {
          setLoggingOut(true);
          await signOut();
        }}
      />

      <main className="main-content flex h-screen min-h-0 flex-col overflow-hidden">
        <header className="page-header flex h-9 shrink-0 items-center justify-between">
          <h1 className="!text-lg !leading-none">
            {activePage === "dashboard"
              ? "ภาพรวมงาน"
              : activePage === "characters"
              ? "จัดการตัวละคร"
              : activePage === "rp-queue"
                ? "คิวตรวจผลงาน"
                : activePage === "item-requests"
                  ? "คำร้องและงานแม่งาน"
                  : activePage === "followers"
                    ? "จัดการผู้ติดตาม"
                    : activePage === "exploration-missions"
                      ? "ภารกิจสำรวจ"
                    : "คลังไอเท็ม"}
          </h1>
          <div className="page-header-actions">
            {activePage === "characters" && (
              <button
                type="button"
                className="primary-button !min-h-8 !px-3 !text-xs"
                onClick={() => setShowCreateCharacter(true)}
              >
                + เพิ่มตัวละคร
              </button>
            )}
          </div>
        </header>

        {activePage === "dashboard" ? (
          <StaffOverview onNavigate={setActivePage} />
        ) : activePage === "characters" ? (
          <section className="workspace min-h-0 flex-1">
            <CharacterDirectory
              characters={filteredCharacters}
              selectedId={selectedCharacter?.id}
              search={search}
              roleFilter={roleFilter}
              positionFilter={positionFilter}
              roleOptions={characterRoleOptions}
              positionOptions={characterPositionOptions}
              loading={loading}
              onSelect={selectCharacter}
              onSearchChange={setSearch}
              onRoleFilterChange={(role) => {
                setRoleFilter(role);
                setPositionFilter("all");
              }}
              onPositionFilterChange={setPositionFilter}
            />
            <CharacterDetail
              character={selectedCharacter}
              inventory={inventory}
              history={history}
              loading={detailLoading}
              onAdjust={setAdjustmentType}
              onGrantItem={() => setShowGrantItem(true)}
            />
          </section>
        ) : activePage === "rp-queue" ? (
          <RpQueue />
        ) : activePage === "item-requests" ? (
          <ItemRequestQueue />
        ) : activePage === "exploration-missions" ? (
          <FollowerMissionQueue />
        ) : activePage === "followers" ? (
          <FollowerManager />
        ) : (
          <InventoryManager />
        )}
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

      {showCreateCharacter && (
        <CreateCharacterModal
          onClose={() => setShowCreateCharacter(false)}
          onCreated={async (character) => {
            setShowCreateCharacter(false);
            await loadCharacters(character.id);
            await selectCharacter(character);
            setNotice({
              type: "success",
              message: `เพิ่ม ${character.character_name} เข้าระบบแล้ว`,
            });
          }}
        />
      )}

      {showGrantItem && selectedCharacter && (
        <GrantItemModal
          character={selectedCharacter}
          onClose={() => setShowGrantItem(false)}
          onSaved={async ({ itemName, quantity, note }) => {
            setShowGrantItem(false);
            const historyResult = await addHistory({
              character_id: selectedCharacter.id,
              action: `เพิ่มไอเท็ม · ${note}`,
              value: `+${formatNumber(quantity)} ${itemName}`,
              type: "item",
            });
            setNotice({
              type: historyResult.error ? "warning" : "success",
              message: historyResult.error
                ? "เพิ่มไอเท็มแล้ว แต่บันทึกประวัติไม่สำเร็จ"
                : `เพิ่ม ${itemName} ให้ ${selectedCharacter.character_name} แล้ว`,
            });
            await selectCharacter(selectedCharacter);
          }}
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

function App() {
  return (
    <StaffGate>
      <StaffApp />
    </StaffGate>
  );
}

export default App;
