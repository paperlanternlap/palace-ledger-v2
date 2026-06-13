import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import {
  Home,
  Users,
  ScrollText,
  Gift,
  FileText,
} from "lucide-react";

function App() {
  const [characters, setCharacters] = useState([]);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState("ทั้งหมด");
  const [search, setSearch] = useState("");
  
  const [editRp, setEditRp] = useState("");
  const [editFavor, setEditFavor] = useState("");
  const [inventory, setInventory] = useState([]);
  const [history, setHistory] = useState([]);
  const [showRpModal, setShowRpModal] = useState(false);
  const [rpAmount, setRpAmount] = useState("");
  const [showFavorModal, setShowFavorModal] = useState(false);
  const [favorAmount, setFavorAmount] = useState("");
  useEffect(() => {
    getCharacters();
  }, []);
  
  // Helper to refresh character data and history
  const refreshSelectedCharacterData = async (characterId) => {
    await getHistory(characterId);
    await getCharacters();
  };
  
  async function getCharacters() {

    const { data, error } = await supabase
  
      .from("characters")
  
      .select("*");
  
    if (error) {
  
      console.error(error);
  
    } else {
      console.log("CHARACTERS =", data);
      console.log("AVATAR =", data?.[0]?.avatar_url);
      setCharacters(data);
    }
  
  }
  async function updateCharacter() {
    const { error } = await supabase
      .from("characters")
      .update({
        rp: editRp,
        favor: editFavor,
      })
      .eq("id", selectedCharacter.id);
  
    if (error) {
      console.error(error);
    } else {
      alert("บันทึกสำเร็จ");
      getCharacters();
    }
  }
  async function getInventory(characterId) {
    const { data, error } = await supabase
      .from("character_inventory")
      .select("*")
      .eq("character_id", characterId);
  
    console.log("ALL INVENTORY =", data);
    console.log("ERROR =", error);
  
    if (error) {
      console.error(error);
    } else {
      setInventory(data);
    }
  }

  async function getHistory(characterId) {
    const { data, error } = await supabase
      .from("character_history")
      .select("*")
      .eq("character_id", characterId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
    } else {
      setHistory(data);
    }
  }

  async function addRp() {
    if (!rpAmount || !selectedCharacter) return;

    const newRp = Number(selectedCharacter.rp) + Number(rpAmount);

    const { error } = await supabase
      .from("characters")
      .update({ rp: newRp })
      .eq("id", selectedCharacter.id);

    if (error) {
      console.error(error);
      return;
    }

    await supabase
      .from("character_history")
      .insert({
        character_id: selectedCharacter.id,
        action: "เพิ่ม RP",
        value: `+${rpAmount} RP`,
        type: "rp",
      });

    setSelectedCharacter({
      ...selectedCharacter,
      rp: newRp,
    });

    setRpAmount("");
    setShowRpModal(false);
    await refreshSelectedCharacterData(selectedCharacter.id);
  }
  async function addFavor() {
    if (!favorAmount || !selectedCharacter) return;

    const newFavor = Number(selectedCharacter.favor) + Number(favorAmount);

    const { error } = await supabase
      .from("characters")
      .update({ favor: newFavor })
      .eq("id", selectedCharacter.id);

    if (error) {
      console.error(error);
      return;
    }

    await supabase
      .from("character_history")
      .insert({
        character_id: selectedCharacter.id,
        action: "เพิ่มโปรดปราน",
        value: `+${favorAmount} Favor`,
        type: "favor",
      });

    setSelectedCharacter({
      ...selectedCharacter,
      favor: newFavor,
    });

    setFavorAmount("");
    setShowFavorModal(false);
    await refreshSelectedCharacterData(selectedCharacter.id);
  }

  // Status counts for statistic cards
  const statusCounts = {
    pending: characters.filter(c => c.status === 'รอตรวจสอบ').length,
    approved: characters.filter(c => c.status === 'อนุมัติแล้ว').length,
    rejected: characters.filter(c => c.status === 'ไม่ผ่าน').length,
    withdrawn: characters.filter(c => c.status === 'ถอนตัว').length,
  };

  // Filtered character list for display
  const filteredCharacters = characters.filter(
    (character) =>
      (selectedStatus === 'ทั้งหมด' || character.status === selectedStatus) &&
      (
        character.character_name?.toLowerCase().includes(search.toLowerCase()) ||
        character.player_name?.toLowerCase().includes(search.toLowerCase()) ||
        character.username?.toLowerCase().includes(search.toLowerCase())
      )
  );

  return (
    
    
    
<div className="flex flex-col lg:flex-row min-h-screen bg-stone-100">
 <div className="w-full lg:w-64 shrink-0 bg-[#fcfaf6] border-b lg:border-b-0 lg:border-r border-[#e6dfd0] p-4 lg:p-6">

 <div className="mb-8">

  <h2 className="text-3xl font-bold">
    หลันโจว
  </h2>

  <p className="text-xs text-stone-400 tracking-widest">
    PALACE LEDGER
  </p>

</div>

<div className="flex lg:block gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">

  <div className="shrink-0 p-3 rounded-xl hover:bg-stone-100 cursor-pointer">
  <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-stone-100 cursor-pointer">

<Home size={18} />

Dashboard

</div>
  </div>

  <div className="shrink-0 p-3 rounded-xl bg-amber-100 text-amber-900 font-semibold">
  <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-100 text-amber-900 font-semibold">
  <Users size={18} />
  Characters
</div>
  </div>

  <div className="shrink-0 p-3 rounded-xl hover:bg-stone-100 cursor-pointer">
  <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-stone-100 cursor-pointer">
  <ScrollText size={18} />
  RP Queue
  </div>
  </div>

  <div className="shrink-0 p-3 rounded-xl hover:bg-stone-100 cursor-pointer">
  <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-stone-100 cursor-pointer">
  <Gift size={18} />
  Shop
  </div>
  </div>

  <div className="shrink-0 p-3 rounded-xl hover:bg-stone-100 cursor-pointer">
  <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-stone-100 cursor-pointer">
  <FileText size={18} />
  Activity log
  </div>
  </div>

</div>

</div>

<div className="flex-1 min-w-0 p-3 md:p-4 lg:p-5">
<div className="grid grid-cols-2 xl:grid-cols-5 gap-5 mb-8">

<div className="bg-[#fcfaf6] rounded-3xl p-5 border border-[#ddd0bb] shadow-sm">
  <p>Characters</p>
  <h2 className="text-3xl font-bold mt-1">
    {characters.length}
</h2>
</div>
<div className="bg-[#fcfaf6] rounded-3xl p-5 border border-[#ddd0bb] shadow-sm">
  <p>รอตรวจสอบ</p>
  <h2 className="text-4xl font-bold mt-2">
    {statusCounts.pending}
</h2>
</div>

<div className="bg-[#fcfaf6] rounded-3xl p-5 border border-[#ddd0bb] shadow-sm">
  <p>อนุมัติแล้ว</p>
  <h2 className="text-4xl font-bold mt-2">
    {statusCounts.approved}
</h2>
</div>

<div className="bg-[#fcfaf6] rounded-3xl p-5 border border-[#ddd0bb] shadow-sm">
  <p>ไม่ผ่าน</p>
  <h2 className="text-4xl font-bold mt-2">
    {statusCounts.rejected}
</h2>
</div>

<div className="bg-[#fcfaf6] rounded-3xl p-5 border border-[#ddd0bb] shadow-sm">
  <p>ถอนตัว</p>
  <h2 className="text-4xl font-bold mt-2">
    {statusCounts.withdrawn}
</h2>
</div>

</div>
 {/* รายชื่อ */}
<div className="bg-[#fcfaf6] rounded-3xl p-6 md:p-8 shadow-sm border border-[#ddd0bb] overflow-hidden">
 

  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
    <h2 className="text-3xl font-bold text-[#4b3a2a]">
      Characters
    </h2>

    <div className="flex flex-col sm:flex-row gap-3">
      <input
        type="text"
        placeholder="ค้นหาชื่อตัวละคร หรือ ผู้เล่น..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full lg:w-80 h-11 px-4 rounded-xl border border-[#ddd0bb] bg-white"
      />

      <button className="bg-[#8f9c72] hover:bg-[#7d8a63] text-white px-5 rounded-xl h-11 font-medium">
        + เพิ่มตัวละคร
      </button>
    </div>
  </div>
    <div
  style={{
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginBottom: "15px",
  }}
>
  {[
    "ทั้งหมด",
   "ยืนยันตัวละครแล้ว",

  "รอตรวจสอบ",

  "อนุมัติแล้ว",

  "ไม่ผ่าน",

  "ถอนตัวละคร",
  ].map((status) => (
    <button
      key={status}
      onClick={() => setSelectedStatus(status)}
      style={{
        padding: "4px 8px",        
        borderRadius: "8px",
        border: "1px solid #ddd0bb",
        background:
selectedStatus === status
? "#bfc8a8"
: "#ffffff",
color:
selectedStatus === status
? "#4d4032"
: "#666"
      }}
    >
      {status}
    </button>
  ))}
</div>
<div className="grid xl:grid-cols-[260px_1fr] gap-5">

<div className="space-y-3">
{filteredCharacters.map((character) => (
    <div
      key={character.id}
      onClick={() => {
        setSelectedCharacter(character);
        setEditRp(character.rp);
        setEditFavor(character.favor);
        getInventory(character.id);
        getHistory(character.id);
      }}
      className={`
rounded-xl
  p-3
  cursor-pointer
  border
  shadow-sm
  transition-all
  hover:shadow-md
  hover:border-[#d8cfbf]
        ${
          selectedCharacter?.id === character.id
            ? "bg-[#eef1e3] border-[#bfc8a8] shadow-md"
            : "bg-[#f8f4ed] border-[#ddd0bb]"
        }
      `}
    >
       <div className="flex items-center justify-between gap-3">

{character.avatar_url ? (
  <img
    src={character.avatar_url}
    alt={character.character_name}
    referrerPolicy="no-referrer"
    className="w-10 h-10 rounded-full object-cover bg-stone-200"
  />
) : (
  <div className="w-10 h-10 rounded-full bg-stone-200" />
)}

<div className="flex-1">
  <h4 className="font-semibold text-sm">
    {character.character_name}
  </h4>

  <p className="text-xs text-stone-500 mt-1">
  ผู้เล่น : {character.player_name}
</p>

</div>

<span
  className={`
    px-2 py-1 rounded-full shrink-0 text-xs font-medium

    ${
      character.status === "ยืนยันตัวละครแล้ว"
        ? "bg-green-100 text-green-700"
        : character.status === "รอตรวจสอบ"
        ? "bg-yellow-100 text-yellow-700"
        : character.status === "อนุมัติแล้ว"
        ? "bg-blue-100 text-blue-700"
        : character.status === "ไม่ผ่าน"
        ? "bg-red-100 text-red-700"
        : "bg-stone-100 text-stone-700"
    }
  `}
>
  {character.status}
</span>

</div>
      </div>
    ))}
  </div>
{/* ปิดคอลัมน์ซ้าย */}

  {/* รายละเอียด */}

   {/* Character Detail Panel */}
   <div className="w-full min-w-0 border border-[#e3d6bf] rounded-3xl p-8 bg-[#fdfbf7] overflow-hidden">
  {selectedCharacter ? (
    <>
   <div>
   <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-8 items-start">

{selectedCharacter.avatar_url && selectedCharacter.avatar_url.trim() !== "" ? (
  <img
    src={selectedCharacter.avatar_url}
    alt={selectedCharacter.character_name}
    referrerPolicy="no-referrer"
    className="w-[180px] aspect-square object-cover rounded-3xl shadow-sm border border-[#e3d6bf] mx-auto lg:mx-0"
  />
) : (
  <div className="w-[180px] aspect-square bg-stone-200 rounded-3xl flex items-center justify-center mx-auto lg:mx-0">
    ไม่มีรูป
  </div>
)}

<div className="flex-1 pt-2">

<div className="flex items-start justify-between w-full mb-3">
  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-2 mb-1">
      <h1 className="text-[20px] font-bold text-[#5b4534] leading-none whitespace-nowrap">
        {selectedCharacter.character_name}
      </h1>
      <span className="px-3 py-1 rounded-xl bg-[#eef1e3] text-[#5f7044] text-xs font-medium whitespace-nowrap">
        {selectedCharacter.status}
      </span>
    </div>
    <p className="text-stone-500 text-sm">
      {selectedCharacter.role}
    </p>
  </div>
  <button className="ml-auto border border-[#e3d6bf] rounded-xl px-5 py-2 bg-white hover:bg-stone-50 text-sm shrink-0">
    ✎ แก้ไขข้อมูล
  </button>
</div>

  <div className="flex flex-col xl:flex-row xl:items-center justify-between mt-4 gap-6">
    <div className="flex items-start gap-8 border-l border-r border-[#e8dfd0] px-5 py-1 flex-1">
      <div className="min-w-[70px]">
        <p className="text-[11px] text-stone-400 mb-1">ผู้เล่น</p>
        <p className="font-medium text-[#4b3a2a]">{selectedCharacter.player_name}</p>

        <p className="text-[11px] text-stone-400 mt-3 mb-1">
          เข้าร่วมเมื่อ
        </p>
        <p className="text-sm text-[#4b3a2a]">
          10 พ.ค. 2025
        </p>
      </div>
      <div className="min-w-[50px]">
        <p className="text-[11px] text-stone-400 mb-1">ตำแหน่ง</p>
        <p className="font-medium text-[#4b3a2a]">{selectedCharacter.position}</p>
      </div>
      <div className="min-w-[50px]">
        <p className="text-[11px] text-stone-400 mb-1">ตำหนัก</p>
        <p className="font-medium text-[#4b3a2a]">{selectedCharacter.palace}</p>
      </div>
    </div>

<div className="border border-[#e3d6bf] rounded-2xl overflow-hidden bg-[#fdfbf7] w-[180px] shadow-sm shrink-0">
  <div className="flex justify-between items-center px-4 py-2.5">
    <span className="text-sm text-stone-400">RP</span>
    <span className="text-lg font-bold text-[#4b3a2a]">{selectedCharacter.rp}</span>
  </div>
  <div className="h-px bg-[#e8dfd0]" />
  <div className="flex justify-between items-center px-4 py-2.5">
    <span className="text-sm text-stone-400">โปรดปราน</span>
    <span className="text-lg font-bold text-[#4b3a2a]">{selectedCharacter.favor}</span>
  </div>
</div>

</div>


</div>

</div>
</div>
      
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 max-w-[530px]">

<button
  onClick={() => setShowRpModal(true)}
  className="
    bg-[#eef1e3] text-[#4f6b35] hover:bg-[#dfe5ce] transition-colors
    rounded-1xl
    py-3
    text-base
    font-semibold
    shadow-sm
  "
>
  ＋ RP
</button>

<button
  onClick={() => setShowFavorModal(true)}
  className="
    bg-[#fff0ee] text-[#cc5c4f] hover:bg-[#ffe2dd] transition-colors
    rounded-2xl
    py-3
    text-base
    font-semibold
    shadow-sm
  "
>
  ＋ โปรดปราน
</button>

<button
  className="
    bg-[#f1f2fb] text-[#5566a5] hover:bg-[#e4e8ff] transition-colors
    rounded-2xl
    py-3
    text-base
    font-semibold
    shadow-sm
  "
>
  ＋ ไอเทม
</button>

</div>
<div className="h-px bg-[#e8dfd0] my-8"></div>
<div className="grid grid-cols-1 xl:grid-cols-[260px_1fr] gap-8 mt-10">

  <div className="bg-[#fdfbf7] rounded-3xl p-7 min-h-[340px] border border-[#e3d6bf] shadow-sm">
    <h3 className="text-xl font-bold text-[#4b3a2a] mb-6">
      คลังเก็บของ
    </h3>

    <div className="space-y-2">
      {inventory.map((item) => (
        <div
          key={item.id}
          className="flex justify-between py-3 border-b border-[#e8dfd0]"
        >
          <span>{item.item_name}</span>
          <span>x{item.quantity}</span>
        </div>
      ))}
    </div>
  </div>

  <div className="bg-[#fdfbf7] rounded-3xl p-7 h-[500px] border border-[#e3d6bf] shadow-sm">
    <h3 className="text-xl font-bold text-[#4b3a2a] mb-6">
      กิจกรรมล่าสุด
    </h3>
    <div className="h-[400px] overflow-y-auto pr-2">
      {history.length === 0 ? (
        <p className="text-stone-400">
          ยังไม่มีกิจกรรม
        </p>
      ) : (
        history.map((log, index) => {
          const color =
            log.type === "rp"
              ? "bg-green-100 border-green-300"
              : log.type === "favor"
              ? "bg-rose-100 border-rose-300"
              : log.type === "item"
              ? "bg-blue-100 border-blue-300"
              : "bg-stone-100 border-stone-300";

          return (
            <div key={log.id} className="relative pl-10 pb-6">
              {index !== history.length - 1 && (
                <div className="absolute left-[9px] top-5 w-px h-full bg-[#e8dfd0]" />
              )}

              <div className={`absolute left-0 top-1 w-5 h-5 rounded-full border ${color}`} />

              <div className="pb-2 flex items-center gap-4 flex-wrap">
                <p className="text-xs text-stone-400 whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString('th-TH')}
                </p>

                <p className="font-semibold text-[#4b3a2a] whitespace-nowrap">
                  {log.value}
                </p>

                <span className="px-3 py-1 rounded-xl text-xs bg-[#f3f0e8] text-[#6b5a49] whitespace-nowrap">
                  {log.action}
                </span>
              </div>
            </div>
          );
        })
      )}
    </div>
  </div>

</div>
    </>
 ) : (
  <div className="h-full flex items-center justify-center">

    <div className="text-center">

      <h2 className="text-3xl font-bold text-stone-700">
        เลือกตัวละคร
      </h2>

      <p className="text-stone-400 mt-3">
        เลือกตัวละครจากรายการด้านซ้าย
        เพื่อดูข้อมูล รายการไอเทม และประวัติการดำเนินการ
      </p>

    </div>

  </div>
)}
</div>
</div>
</div>
  </div>
  {/* Modal for เพิ่ม RP */}
  {showRpModal && (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-80">
        <h2 className="text-xl font-semibold mb-4">
          เพิ่ม RP
        </h2>

        <input
          type="number"
          value={rpAmount}
          onChange={(e) => setRpAmount(e.target.value)}
          className="w-full border rounded-xl p-3"
        />

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setShowRpModal(false)}
            className="flex-1 border rounded-xl py-2"
          >
            ยกเลิก
          </button>

          <button
            onClick={addRp}
            className="flex-1 bg-green-600 text-white rounded-xl py-2"
          >
            บันทึก
          </button>
        </div>
      </div>
    </div>
  )}
{showFavorModal && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div className="bg-white rounded-2xl p-6 w-80">
      <h2 className="text-xl font-semibold mb-4">
        เพิ่มโปรดปราน
      </h2>

      <input
        type="number"
        value={favorAmount}
        onChange={(e) => setFavorAmount(e.target.value)}
        className="w-full border rounded-xl p-3"
      />

      <div className="flex gap-2 mt-4">
        <button
          onClick={() => setShowFavorModal(false)}
          className="flex-1 border rounded-xl py-2"
        >
          ยกเลิก
        </button>

        <button
          onClick={addFavor}
          className="flex-1 bg-green-600 text-white rounded-xl py-2"
        >
          บันทึก
        </button>
      </div>
    </div>
  </div>
)}
  </div>

  
  )
  
}

export default App