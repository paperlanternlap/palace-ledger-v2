import { useEffect, useState } from "react";
import { supabase } from "./supabase";

function App() {
  const [characters, setCharacters] = useState([]);
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
  return (
    <div>

    {characters.map((character) => (

      <div

        key={character.id}

        className="bg-white rounded-2xl shadow p-6 mb-4"

      >

        <h2 className="text-3xl font-bold">

          {character.character_name}

        </h2>

        <p className="text-gray-500">

          {character.role} | {character.position}

        </p>

        <div className="mt-4 space-y-2">

          <p>ตำหนัก: {character.palace}</p>

          <p>RP: {character.rp}</p>

          <p>โปรดปราน: {character.favor}</p>

        </div>

        <button className="mt-4 border px-3 py-1 rounded">

          แก้ไข

        </button>

      </div>

    ))}

  </div>
  )
}

export default App