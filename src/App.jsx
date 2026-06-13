import { useEffect, useState } from "react";
import { supabase } from "./supabase";

function App() {
  const [characters, setCharacters] = useState([]);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState("ทั้งหมด");
  const [search, setSearch] = useState("");
  
  const [editRp, setEditRp] = useState("");
  const [editFavor, setEditFavor] = useState("");
  useEffect(() => {
    getCharacters();
  }, []);
  
  async function getCharacters() {

    const { data, error } = await supabase
  
      .from("characters")
  
      .select("*");
  
    if (error) {
  
      console.error(error);
  
    } else {
  
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
  return (
    
    
    
    <div

    style={{

      display: "flex",

      minHeight: "100vh",

      backgroundColor: "#f7f4ed",

    }}
  >
 <div className="w-64 bg-white border-r border-stone-200 p-6">

 <h2 className="text-3xl font-bold mb-8">
  🏯 หลันโจว
</h2>

<div className="space-y-2">

  <div className="p-3 rounded-xl hover:bg-stone-100 cursor-pointer">
    🏠 Dashboard
  </div>

  <div className="p-3 rounded-xl bg-amber-100 text-amber-900 font-semibold">
    👘 Characters
  </div>

  <div className="p-3 rounded-xl hover:bg-stone-100 cursor-pointer">
    📝 RP Queue
  </div>

  <div className="p-3 rounded-xl hover:bg-stone-100 cursor-pointer">
    🎁 Shop
  </div>

  <div className="p-3 rounded-xl hover:bg-stone-100 cursor-pointer">
    📜 Activity Log
  </div>

</div>

</div>

<div style={{ flex: 1, padding: "20px" }}>
 

<div
  style={{
    display: "flex",
    gap: "20px",
  }}
>
  {/* รายชื่อ */}

  <div className="w-80 bg-white rounded-3xl p-6 shadow-sm">
    <h3>Characters</h3>
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
    "รอตรวจสอบ",
    "ยืนยันตัวละครแล้ว",
    "อนุมัติแล้ว",
    "ไม่ผ่าน",
    "ถอนตัวละคร",
  ].map((status) => (
    <button
      key={status}
      onClick={() => setSelectedStatus(status)}
      style={{
        padding: "6px 10px",
        borderRadius: "8px",
        border: "1px solid #ccc",
        background:
          selectedStatus === status ? "#d9c7a3" : "white",
      }}
    >
      {status}
    </button>
  ))}
</div>
<input
  type="text"
  placeholder="🔍 ค้นหาตัวละคร..."
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  style={{
    width: "100%",
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #ddd",
    marginBottom: "15px",
  }}
/>
{characters
  .filter(
    (character) =>
      (selectedStatus === "ทั้งหมด" ||
        character.status === selectedStatus) &&

      (
        character.character_name
          ?.toLowerCase()
          .includes(search.toLowerCase()) ||

        character.player_name
          ?.toLowerCase()
          .includes(search.toLowerCase()) ||

        character.username
          ?.toLowerCase()
          .includes(search.toLowerCase())
      )
  )
  .map((character) => (
    <div
      key={character.id}
      onClick={() => {
        setSelectedCharacter(character);
        setEditRp(character.rp);
        setEditFavor(character.favor);
      }}
      className="
        bg-stone-50
        rounded-2xl
        p-4
        mb-3
        cursor-pointer
        hover:bg-amber-50
        transition
      "
    >
       <div>

       <h4 className="font-bold text-lg">

{character.character_name}

</h4>

<p

  style={{

    margin: "4px 0",

    fontSize: "13px",

    color: "#777",

  }}

>

  {character.role} | {character.position}

</p>

<small>{character.status}</small>

</div>
      </div>
    ))}
  </div>

  {/* รายละเอียด */}

  <div className="flex-1 bg-white rounded-3xl p-8 shadow-sm">
  {selectedCharacter ? (
    <div>
      <h1 className="text-6xl font-bold text-center">
  {selectedCharacter.character_name}
</h1>

<p className="text-center text-stone-500 mt-3">
  {selectedCharacter.role} | {selectedCharacter.position}
</p>

      <div className="h-px bg-stone-200 my-6"></div>

      

      <div
  style={{
    display: "flex",
    gap: "15px",
    marginTop: "15px",
    marginBottom: "15px",
  }}
>
<div
  style={{
    flex: 1,
    background: "#faf7f2",
    padding: "20px",
    borderRadius: "12px",
    textAlign: "center",
  }}
>
<p className="text-stone-500">
  ⭐ RP
</p>

<h2 className="text-5xl font-bold">
  {selectedCharacter.rp}
</h2>
</div>

  <div
    style={{
      flex: 1,
      background: "#faf7f2",
      padding: "20px",
      borderRadius: "12px",
      textAlign: "center",
    }}
  >
<p className="text-stone-500">
  ❤️ Favor
</p>

<h2 className="text-5xl font-bold">
  {selectedCharacter.favor}
</h2>
  </div>
</div>
<div className="text-center space-y-2">

  <p>
    🏯 ตำหนัก: {selectedCharacter.palace}
  </p>

  <p>
    📌 สถานะ: {selectedCharacter.status}
  </p>

  <p>
    👤 ผู้เล่น: {selectedCharacter.player_name}
  </p>

  <p>
    🆔 Username: {selectedCharacter.username}
  </p>

</div>

<div className="h-px bg-stone-200 my-6"></div>
      <div
  style={{
    marginTop: "20px",
    display: "flex",
    gap: "10px",
  }}
>
  <button>✏️ แก้ไขข้อมูล</button>

  <button>✅ อนุมัติ</button>

  <button>❌ ไม่ผ่าน</button>

  <button>🚪 ถอนตัวละคร</button>
</div>
      </div>
  ) : (
    <h2>เลือกตัวละคร</h2>
  )}
</div>
</div>

  </div>
 
  </div>
  
  )
  
}

export default App