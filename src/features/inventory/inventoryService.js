import { supabase } from "../../supabase";

export function getCatalogItems() {
  return supabase
    .from("items")
    .select("*")
    .order("active", { ascending: false })
    .order("name", { ascending: true });
}

export function createCatalogItem({
  name,
  description,
  isLimited,
  stockQuantity,
  lowStockThreshold,
}) {
  return supabase
    .from("items")
    .insert({
      name,
      description: description || null,
      is_limited: isLimited,
      stock_quantity: isLimited ? stockQuantity : 0,
      low_stock_threshold: lowStockThreshold,
    })
    .select()
    .single();
}

export function adjustItemStock(itemId, quantityChange, note) {
  return supabase.rpc("adjust_item_stock", {
    p_item_id: itemId,
    p_quantity_change: quantityChange,
    p_note: note || null,
  });
}

export function updateCatalogItem({
  id,
  name,
  description,
  useCategory,
  defaultChannel,
  requiresTarget,
  requiresRoll,
  actionTemplate,
  active,
}) {
  return supabase.rpc("update_catalog_item", {
    p_item_id: id,
    p_name: name,
    p_description: description || null,
    p_use_category: useCategory,
    p_default_channel: defaultChannel || null,
    p_requires_target: requiresTarget,
    p_requires_roll: requiresRoll,
    p_action_template: actionTemplate,
    p_active: active,
  });
}
