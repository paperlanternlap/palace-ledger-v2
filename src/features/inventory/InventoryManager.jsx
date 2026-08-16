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

const routeFilters = [
  { id: "shop", label: "แสดงในบัญชีสิ่งของ" },
  { id: "palace_stock", label: "เบิกจากวัง" },
  { id: "external_legal", label: "จัดซื้อภายนอก" },
  { id: "restricted", label: "ซื้อจาก NPC" },
  { id: "reward", label: "ของแจก / รางวัล" },
  { id: "story", label: "ของเนื้อเรื่อง" },
  { id: "all", label: "ทุกช่องทาง" },
];

const stockFilters = [
  { id: "all", label: "ทุกสถานะ" },
  { id: "limited", label: "จำกัดจำนวน" },
  { id: "low", label: "ใกล้หมด" },
  { id: "out", label: "หมด" },
];

const categoryLabels = {
  general: "ของใช้ทั่วไป",
  favor: "เพิ่มโปรดปราน",
  medicine: "ยาและการรักษา",
  secret: "แผนลับ",
  access: "เปิดพื้นที่",
  defense: "ป้องกัน",
  story: "เนื้อเรื่อง",
};

function getAcquisitionLabel(item) {
  if (item.acquisition_type === "palace_stock") return "เบิกจากคลัง";
  if (item.acquisition_type === "external_legal") return "จัดซื้อภายนอก";
  if (item.acquisition_type === "restricted") return "ซื้อจาก NPC";
  if (item.acquisition_type === "story_only" || item.use_category === "story") return "ของเนื้อเรื่อง";
  return "ของแจก / รางวัล";
}

function ItemCard({ item, onAdjust, onEdit }) {
  const isOut = item.is_limited && item.stock_quantity === 0;
  const isLow =
    item.is_limited &&
    item.stock_quantity > 0 &&
    item.stock_quantity <= item.low_stock_threshold;
  const fulfillmentLabel =
    item.fulfillment_type === "staff_request"
      ? "สร้างงานให้สต๊าฟ"
      : "เข้าคลังตัวละคร";
  const currencyLabel =
    item.price_currency === "favor" ? "โปรดปราน" : "RP";

  return (
    <article className={`catalog-item ${isOut ? "out" : isLow ? "low" : ""}`}>
      <div className="catalog-item-head">
        <span className="item-category">
          {categoryLabels[item.use_category] || "ของใช้ทั่วไป"}
        </span>
        {isOut ? (
          <span className="stock-state out">หมด</span>
        ) : isLow ? (
          <span className="stock-state low">ใกล้หมด</span>
        ) : (
          <span className="stock-state available">พร้อมใช้</span>
        )}
      </div>

      <div className="catalog-item-copy">
        <h3>{item.name}</h3>
        <p>{item.description || "ยังไม่มีรายละเอียด"}</p>
      </div>

      <div className="catalog-tags" aria-label="รูปแบบการได้รับ">
        <span className={item.shop_available ? "shop" : ""}>
          {getAcquisitionLabel(item)}
        </span>
        <span className={item.fulfillment_type === "staff_request" ? "task" : ""}>
          {fulfillmentLabel}
        </span>
        {item.acquisition_type === "restricted" && (
          <span className="task">
            {item.acquisition_channel?.npc_name || "ยังไม่กำหนด NPC"}
            {` · เสี่ยง ${item.acquisition_risk_level || 1}/5`}
          </span>
        )}
      </div>

      <div className="catalog-commerce">
        <div>
          <small>{item.shop_available ? "ค่าใช้ RP" : "ไม่เปิดในบัญชีสิ่งของ"}</small>
          <strong>
            {item.shop_available ? (
              <>
                {Number(item.cost || 0).toLocaleString("th-TH")}{" "}
                <em>{currencyLabel}</em>
              </>
            ) : (
              "มอบโดยสต๊าฟ"
            )}
          </strong>
        </div>
        <div className="catalog-stock-compact">
          <small>สต็อก</small>
          {item.is_limited ? (
            <strong>
              {item.stock_quantity} <em>ชิ้น</em>
            </strong>
          ) : (
            <strong className="unlimited">
              <InfinityIcon size={18} /> <em>ไม่จำกัด</em>
            </strong>
          )}
        </div>
      </div>

      <div className={`catalog-item-actions ${item.is_limited ? "" : "single"}`}>
        <button type="button" onClick={() => onEdit(item)}>
          แก้ไขรายละเอียด
        </button>
        {item.is_limited && (
          <button type="button" onClick={() => onAdjust(item)}>
            ปรับสต็อก
          </button>
        )}
      </div>
    </article>
  );
}

export function InventoryManager() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [routeFilter, setRouteFilter] = useState("shop");
  const [stockFilter, setStockFilter] = useState("all");
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
      const matchesRoute =
        routeFilter === "all" ||
        (routeFilter === "shop" && item.shop_available) ||
        (["palace_stock", "external_legal", "restricted"].includes(routeFilter) &&
          item.acquisition_type === routeFilter) ||
        (routeFilter === "reward" &&
          !item.shop_available &&
          item.use_category !== "story") ||
        (routeFilter === "story" &&
          !item.shop_available &&
          item.use_category === "story");
      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "limited" && item.is_limited) ||
        (stockFilter === "low" &&
          item.is_limited &&
          item.stock_quantity > 0 &&
          item.stock_quantity <= item.low_stock_threshold) ||
        (stockFilter === "out" && item.is_limited && item.stock_quantity === 0);
      return matchesSearch && matchesRoute && matchesStock;
    });
  }, [items, routeFilter, search, stockFilter]);

  const itemPages = useListPagination(
    filteredItems,
    8,
    `${routeFilter}|${stockFilter}|${search}`,
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
          <div className="search-box inventory-search">
            <Search size={17} />
            <input
              type="search"
              value={search}
              placeholder="ค้นหาชื่อหรือรายละเอียดไอเท็ม"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            className="inventory-filter-select"
            value={routeFilter}
            aria-label="กรองตามช่องทางได้รับ"
            onChange={(event) => setRouteFilter(event.target.value)}
          >
            {routeFilters.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
          <select
            className="inventory-filter-select"
            value={stockFilter}
            aria-label="กรองตามสถานะสต็อก"
            onChange={(event) => setStockFilter(event.target.value)}
          >
            {stockFilters.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
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
