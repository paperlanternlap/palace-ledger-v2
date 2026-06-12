function App() {
  return (
    <div className="min-h-screen bg-stone-100 p-8">
      <h1 className="text-5xl font-bold text-center mb-10">
        🏮 Palace Ledger
      </h1>

      <div className="max-w-4xl mx-auto">
        <button className="bg-red-700 text-white px-4 py-2 rounded-lg mb-6">
          + เพิ่มตัวละคร
        </button>

        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-3xl font-bold">หลี่ซูเหยา</h2>

          <p className="text-gray-500">
            พระสนม | ซู่อี้
          </p>

          <div className="mt-4 space-y-2">
            <p>ตำหนัก: บุปผา</p>
            <p>RP: 1200</p>
            <p>โปรดปราน: 35</p>
          </div>

          <button className="mt-4 border px-3 py-1 rounded">
            แก้ไข
          </button>
        </div>
      </div>
    </div>
  )
}

export default App