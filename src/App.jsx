import { useCallback, useEffect, useMemo, useState } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { StaffPageContent } from "./components/layout/StaffPageContent";
import { StaffGate } from "./features/auth/StaffGate";
import { AdjustmentModal } from "./features/characters/AdjustmentModal";
import { GrantItemModal } from "./features/characters/GrantItemModal";
import { CreateCharacterModal } from "./features/characters/CreateCharacterModal";
import { DemotionModal } from "./features/characters/DemotionModal";
import { PromotionModal } from "./features/characters/PromotionModal";
import { SpecialAppointmentModal } from "./features/characters/SpecialAppointmentModal";
import { NpcAcquaintanceModal } from "./features/characters/NpcAcquaintanceModal";
import {
  adjustCharacterResource,
  demoteCharacter,
  promoteCharacter,
  specialAppointCharacter,
  getCharacterDetails,
  getCharacters,
} from "./features/characters/characterService";
import {
  filterCharacters,
  formatNumber,
} from "./features/characters/utils";
import { signOut } from "./features/auth/authService";
import { getStaffPageTitle } from "./config/staffNavigation";
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
  const [npcAcquaintances, setNpcAcquaintances] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState(null);
  const [showGrantItem, setShowGrantItem] = useState(false);
  const [showCreateCharacter, setShowCreateCharacter] = useState(false);
  const [showDemotion, setShowDemotion] = useState(false);
  const [showPromotion, setShowPromotion] = useState(false);
  const [showSpecialAppointment, setShowSpecialAppointment] = useState(false);
  const [showNpcAcquaintance, setShowNpcAcquaintance] = useState(false);
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
    setNpcAcquaintances([]);
    setDetailLoading(true);

    const results = await getCharacterDetails(character.id);
    if (results.inventory.error || results.history.error || results.npcAcquaintances.error) {
      setNotice({ type: "error", message: "โหลดรายละเอียดบางส่วนไม่สำเร็จ" });
    }
    setInventory(results.inventory.data || []);
    setHistory(results.history.data || []);
    setNpcAcquaintances(results.npcAcquaintances.data || []);
    setDetailLoading(false);
  }

  async function submitAdjustment({ amount, operation, note }) {
    if (!selectedCharacter || amount <= 0 || !note) return;
    setSubmitting(true);

    const field = adjustmentType === "rp" ? "rp" : "favor";
    const delta = operation === "subtract" ? -amount : amount;
    const { error } = await adjustCharacterResource({
      characterId: selectedCharacter.id,
      resource: field,
      delta,
      note,
    });

    if (error) {
      setNotice({
        type: "error",
        message: error.message?.includes("Insufficient resource")
          ? "ไม่สามารถหักเกินจำนวนที่ตัวละครมีอยู่ได้"
          : "บันทึกคะแนนไม่สำเร็จ กรุณาลองอีกครั้ง",
      });
      setSubmitting(false);
      return;
    }

    const updatedCharacter = {
      ...selectedCharacter,
      [field]: Number(selectedCharacter[field] || 0) + delta,
    };
    setAdjustmentType(null);
    setSubmitting(false);
    setNotice({
      type: "success",
      message: operation === "subtract" ? "หักคะแนนเรียบร้อย" : "เพิ่มคะแนนเรียบร้อย",
    });
    await loadCharacters(updatedCharacter.id);
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
            {getStaffPageTitle(activePage)}
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

        <StaffPageContent
          activePage={activePage}
          onNavigate={setActivePage}
          characterWorkspace={{
            directory: {
              characters: filteredCharacters,
              selectedId: selectedCharacter?.id,
              search,
              roleFilter,
              positionFilter,
              roleOptions: characterRoleOptions,
              positionOptions: characterPositionOptions,
              loading,
              onSelect: selectCharacter,
              onSearchChange: setSearch,
              onRoleFilterChange: (role) => {
                setRoleFilter(role);
                setPositionFilter("all");
              },
              onPositionFilterChange: setPositionFilter,
            },
            detail: {
              character: selectedCharacter,
              inventory,
              history,
              npcAcquaintances,
              loading: detailLoading,
              onAdjust: setAdjustmentType,
              onGrantItem: () => setShowGrantItem(true),
              onPromote: () => setShowPromotion(true),
              onDemote: () => setShowDemotion(true),
              onSpecialAppointment: () => setShowSpecialAppointment(true),
              onManageNpcAcquaintances: () => setShowNpcAcquaintance(true),
            },
          }}
        />
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
          inventory={inventory}
          onClose={() => setShowGrantItem(false)}
          onSaved={async ({ itemName, quantity, operation }) => {
            setShowGrantItem(false);
            setNotice({
              type: "success",
              message:
                operation === "add"
                  ? `เพิ่ม ${itemName} ให้ ${selectedCharacter.character_name} แล้ว`
                  : `นำ ${itemName} จำนวน ${formatNumber(quantity)} ชิ้นออกแล้ว`,
            });
            await selectCharacter(selectedCharacter);
          }}
        />
      )}

      {showDemotion && selectedCharacter && (
        <DemotionModal
          character={selectedCharacter}
          submitting={submitting}
          onClose={() => setShowDemotion(false)}
          onSubmit={async ({ note }) => {
            setSubmitting(true);
            const { error } = await demoteCharacter({
              characterId: selectedCharacter.id,
              note,
            });
            setSubmitting(false);
            if (error) {
              setNotice({
                type: "error",
                message: error.message?.includes("No lower rank")
                  ? "ตำแหน่งนี้ไม่สามารถลดขั้นได้อีก"
                  : "ลดขั้นไม่สำเร็จ",
              });
              return;
            }
            setShowDemotion(false);
            setNotice({ type: "success", message: "ลดขั้นและบันทึกประวัติแล้ว" });
            await loadCharacters(selectedCharacter.id);
            const { data } = await getCharacters();
            const fresh = data?.find((item) => item.id === selectedCharacter.id);
            if (fresh) await selectCharacter(fresh);
          }}
        />
      )}

      {showPromotion && selectedCharacter && (
        <PromotionModal
          character={selectedCharacter}
          submitting={submitting}
          onClose={() => setShowPromotion(false)}
          onSubmit={async ({ note }) => {
            setSubmitting(true);
            const { data, error } = await promoteCharacter({
              characterId: selectedCharacter.id,
              note,
            });
            setSubmitting(false);
            if (error) {
              setNotice({
                type: "error",
                message: error.message?.includes("Insufficient favor")
                  ? "โปรดปรานไม่เพียงพอ"
                  : error.message?.includes("promotion is locked")
                    ? "ตัวละครถูกระงับสิทธิ์เลื่อนขั้นด้วยโปรดปราน"
                  : error.message?.includes("slots are full")
                    ? "ตำแหน่งนี้เต็มแล้ว"
                    : error.message?.includes("No higher rank")
                      ? "ตำแหน่งนี้ไม่สามารถเลื่อนขั้นได้อีก"
                      : "เลื่อนขั้นไม่สำเร็จ",
              });
              return;
            }
            setShowPromotion(false);
            setNotice({ type: "success", message: "เลื่อนขั้นและบันทึกประวัติแล้ว" });
            await loadCharacters(data.id);
            await selectCharacter(data);
          }}
        />
      )}

      {showSpecialAppointment && selectedCharacter && (
        <SpecialAppointmentModal
          character={selectedCharacter}
          submitting={submitting}
          onClose={() => setShowSpecialAppointment(false)}
          onSubmit={async (values) => {
            setSubmitting(true);
            const { data, error } = await specialAppointCharacter({
              characterId: selectedCharacter.id,
              ...values,
            });
            setSubmitting(false);
            if (error) {
              setNotice({ type: "error", message: "บันทึกการแต่งตั้งพิเศษไม่สำเร็จ" });
              return;
            }
            setShowSpecialAppointment(false);
            setNotice({
              type: "success",
              message: values.action === "imperial_demote"
                ? "ลดขั้นพิเศษและปิดสิทธิ์เลื่อนขั้นแล้ว"
                : "บันทึกการแต่งตั้งพิเศษแล้ว",
            });
            await loadCharacters(data.id);
            await selectCharacter(data);
          }}
        />
      )}

      {showNpcAcquaintance && selectedCharacter && (
        <NpcAcquaintanceModal
          character={selectedCharacter}
          acquaintances={npcAcquaintances}
          onClose={() => setShowNpcAcquaintance(false)}
          onSaved={async () => {
            setShowNpcAcquaintance(false);
            setNotice({ type: "success", message: "เพิ่ม NPC ที่ตัวละครรู้จักแล้ว" });
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
