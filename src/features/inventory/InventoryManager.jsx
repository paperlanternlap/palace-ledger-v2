import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  Infinity as InfinityIcon,
  PackagePlus,
  Search,
} from "lucide-react";
import {
  ListPagination,
} from "../../components/ui/ListPagination";
import { useListPagination } from "../../components/ui/useListPagination";
import {
  AdjustStockModal,
  CreateItemModal,
  EditItemModal,
} from "./ItemModal";
import { getCatalogItems } from "./inventoryService";

const filters = [
  { id: "all", label: "ทั้งหมด" },
  { id: "limited", label: "จำกัดจำนวน" },
  { id: "low", label: "ใกล้หมด" },
  { id: "out", label: "หมด" },
];

const categoryLabels = {
  general: "ทั่วไป",
  favor: "โปรดปราน / รางวัล",
  medicine: "ยาและการรักษา",
  secret: "แผนลับ",
  access: "เปิดพื้นที่",
  defense: "ป้องกัน",
  story: "เนื้อเรื่อง",
};

function ItemCard({ item, onAdjust, onEdit }) {
  const isOut = item.is_limited && item.stock_quantity === 0;
  const isLow =
    item.is_limited &&
    item.stock_quantity > 0 &&
    item.stock_quantity <= item.low_stock_threshold;

  return (
    <article className={`catalog-item ${isOut ? "out" : isLow ? "low" : ""}`}>
      <div className="catalog-item-head">
        <div>
          <span className="item-category">
            {categoryLabels[item.use_category] || "ทั่วไป"}
          </span>
          <h3>{item.name}</h3>
          <p>{item.description || "ไม่มีรายละเอียด"}</p>
        </div>
        {isOut ? (
          <span className="stock-state out">หมด</span>
        ) : isLow ? (
          <span className="stock-state low">ใกล้หมด</span>
        ) : (
          <span className="stock-state available">พร้อมใช้</span>
        )}
      </div>

      <div className="catalog-stock">
        {item.is_limited ? (
          <>
            <span>คงเหลือ</span>
            <strong>{item.stock_quantity}</strong>
            <small>แจ้งเตือนที่ {item.low_stock_threshold}</small>
          </>
        ) : (
          <>
            <span>สต็อก</span>
            <strong className="unlimited">
              <InfinityIcon size={22} />
            </strong>
            <small>ไม่จำกัดจำนวน</small>
          </>
        )}
      </div>

      <div className="catalog-item-actions">
        <button type="button" onClick={() => onEdit(item)}>
          ตั้งค่าการใช้
        </button>
        <button
          type="button"
          disabled={!item.is_limited}
          onClick={() => onAdjust(item)}
        >
          {item.is_limited ? "ปรับสต็อก" : "สต็อกไม่จำกัด"}
        </button>
      </div>
    </article>
  );
}

export function InventoryManager() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  async function loadItems() {
    setLoading(true);
    const { data, error } = await getCatalogItems();
    if (error) {
      setSetupRequired(
        error.code === "42P01" ||
          error.code === "PGRST205" ||
          error.message?.includes("items"),
      );
      setItems([]);
    } else {
      setSetupRequired(false);
      setItems(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(loadItems, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const summary = useMemo(
    () => ({
      total: items.length,
      limited: items.filter((item) => item.is_limited).length,
      low: items.filter(
        (item) =>
          item.is_limited &&
          item.stock_quantity > 0 &&
          item.stock_quantity <= item.low_stock_threshold,
      ).length,
      out: items.filter(
        (item) => item.is_limited && item.stock_quantity === 0,
      ).length,
    }),
    [items],
  );

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("th");
    return items.filter((item) => {
      const matchesSearch =
        !keyword ||
        [item.name, item.description]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("th")
          .includes(keyword);
      const matchesFilter =
        filter === "all" ||
        (filter === "limited" && item.is_limited) ||
        (filter === "low" &&
          item.is_limited &&
          item.stock_quantity > 0 &&
          item.stock_quantity <= item.low_stock_threshold) ||
        (filter === "out" && item.is_limited && item.stock_quantity === 0);
      return matchesSearch && matchesFilter;
    });
  }, [filter, items, search]);

  const itemPages = useListPagination(
    filteredItems,
    8,
    `${filter}|${search}`,
  );

  if (setupRequired) {
    return (
      <section className="inventory-setup">
        <Boxes size={30} />
        <h2>คลังกลางพร้อมแล้ว แต่ยังไม่ได้ติดตั้งตาราง</h2>
        <p>รัน migration นี้ใน Supabase SQL Editor เพื่อเปิดใช้งาน</p>
        <code>supabase/migrations/20260730_create_item_catalog.sql</code>
      </section>
    );
  }

  return (
    <>
      <section className="inventory-page">
        <div className="inventory-summary">
          <div>
            <Boxes size={19} />
            <span>ไอเท็มทั้งหมด</span>
            <strong>{summary.total}</strong>
          </div>
          <div>
            <PackagePlus size={19} />
            <span>จำกัดจำนวน</span>
            <strong>{summary.limited}</strong>
          </div>
          <div className={summary.low ? "warning" : ""}>
            <AlertTriangle size={19} />
            <span>ใกล้หมด</span>
            <strong>{summary.low}</strong>
          </div>
          <div className={summary.out ? "danger" : ""}>
            <AlertTriangle size={19} />
            <span>หมด</span>
            <strong>{summary.out}</strong>
          </div>
        </div>

        <div className="inventory-toolbar">
          <div className="search-box">
            <Search size={17} />
            <input
              type="search"
              value={search}
              placeholder="ค้นหาไอเท็ม"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="inventory-filters">
            {filters.map((item) => (
              <button
                type="button"
                key={item.id}
                className={filter === item.id ? "selected" : ""}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="primary-button inventory-add-button"
            onClick={() => setShowCreateModal(true)}
          >
            <PackagePlus size={16} /> สร้างไอเท็ม
          </button>
        </div>

        <div className="catalog-grid">
          {loading ? (
            <p className="inventory-message">กำลังโหลดคลังไอเท็ม...</p>
          ) : itemPages.pageItems.length ? (
            itemPages.pageItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onAdjust={setAdjustingItem}
                onEdit={setEditingItem}
              />
            ))
          ) : (
            <p className="inventory-message">ไม่พบไอเท็มในรายการนี้</p>
          )}
        </div>
        <ListPagination
          currentPage={itemPages.currentPage}
          totalPages={itemPages.totalPages}
          onPageChange={itemPages.setPage}
          label="หน้ารายการไอเท็ม"
        />
      </section>

      {showCreateModal && (
        <CreateItemModal
          onClose={() => setShowCreateModal(false)}
          onSaved={async () => {
            setShowCreateModal(false);
            await loadItems();
          }}
        />
      )}

      {adjustingItem && (
        <AdjustStockModal
          item={adjustingItem}
          onClose={() => setAdjustingItem(null)}
          onSaved={async () => {
            setAdjustingItem(null);
            await loadItems();
          }}
        />
      )}

      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={async () => {
            setEditingItem(null);
            await loadItems();
          }}
        />
      )}

    </>
  );
}
