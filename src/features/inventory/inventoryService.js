import { supabase } from "../../supabase";

export function getCatalogItems() {
  return supabase
    .from("items")
    .select("*, acquisition_channel:acquisition_channels(id, npc_name, npc_role, risk_level)")
    .order("active", { ascending: false })
    .order("name", { ascending: true });
}

export function getAcquisitionChannels() {
  return supabase
    .from("acquisition_channels")
    .select("*")
    .eq("active", true)
    .order("npc_name", { ascending: true });
}

export function createCatalogItem({
  name,
  description,
  cost,
  priceCurrency,
  fulfillmentType,
  shopAvailable,
  isLimited,
  stockQuantity,
  lowStockThreshold,
  acquisitionType,
  catalogVisibility,
  acquisitionRequiresRoll,
  acquisitionSuccessPercent,
  minimumFavor,
  commandFavorThreshold,
  fulfillmentDaysMin,
  fulfillmentDaysMax,
  autoFulfill,
  acquisitionChannelId,
  acquisitionRiskLevel,
  failureConsequence,
  criticalFailureConsequence,
}) {
  return supabase
    .from("items")
    .insert({
      name,
      description: description || null,
      cost,
      price_currency: priceCurrency,
      fulfillment_type: fulfillmentType,
      shop_available: shopAvailable,
      is_limited: isLimited,
      stock_quantity: isLimited ? stockQuantity : 0,
      low_stock_threshold: lowStockThreshold,
      acquisition_type: acquisitionType,
      catalog_visibility: catalogVisibility,
      acquisition_requires_roll: acquisitionRequiresRoll,
      acquisition_success_percent: acquisitionSuccessPercent,
      minimum_favor: minimumFavor,
      command_favor_threshold: commandFavorThreshold,
      fulfillment_days_min: fulfillmentDaysMin,
      fulfillment_days_max: fulfillmentDaysMax,
      auto_fulfill: autoFulfill,
      acquisition_channel_id: acquisitionChannelId || null,
      acquisition_risk_level: acquisitionRiskLevel,
      failure_consequence: failureConsequence || null,
      critical_failure_consequence: criticalFailureConsequence || null,
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

export function deleteCatalogItem(itemId) {
  return supabase.rpc("delete_catalog_item", {
    p_item_id: itemId,
  });
}

export async function updateCatalogItem({
  id,
  name,
  description,
  cost,
  priceCurrency,
  fulfillmentType,
  shopAvailable,
  useCategory,
  defaultChannel,
  requiresTarget,
  requiresRoll,
  actionTemplate,
  active,
  acquisitionType,
  catalogVisibility,
  acquisitionRequiresRoll,
  acquisitionSuccessPercent,
  minimumFavor,
  commandFavorThreshold,
  fulfillmentDaysMin,
  fulfillmentDaysMax,
  autoFulfill,
  acquisitionChannelId,
  acquisitionRiskLevel,
  failureConsequence,
  criticalFailureConsequence,
}) {
  const detailsResult = await supabase.rpc("update_catalog_item_details", {
    p_item_id: id,
    p_name: name,
    p_description: description || null,
    p_cost: cost,
    p_use_category: useCategory,
    p_default_channel: defaultChannel || null,
    p_requires_target: requiresTarget,
    p_requires_roll: requiresRoll,
    p_action_template: actionTemplate,
    p_active: active,
  });
  if (detailsResult.error) return detailsResult;

  const shopResult = await supabase.rpc("set_item_shop_availability", {
    p_item_id: id,
    p_shop_available: shopAvailable,
  });
  if (shopResult.error) return shopResult;

  const acquisitionResult = await supabase
    .from("items")
    .update({
      acquisition_type: acquisitionType,
      catalog_visibility: catalogVisibility,
      acquisition_requires_roll: acquisitionRequiresRoll,
      acquisition_success_percent: acquisitionSuccessPercent,
      minimum_favor: minimumFavor,
      command_favor_threshold: commandFavorThreshold,
      fulfillment_days_min: fulfillmentDaysMin,
      fulfillment_days_max: fulfillmentDaysMax,
      auto_fulfill: autoFulfill,
      acquisition_channel_id: acquisitionChannelId || null,
      acquisition_risk_level: acquisitionRiskLevel,
      failure_consequence: failureConsequence || null,
      critical_failure_consequence: criticalFailureConsequence || null,
    })
    .eq("id", id);
  if (acquisitionResult.error) return acquisitionResult;

  return supabase.rpc("set_item_purchase_settings", {
    p_item_id: id,
    p_price_currency: priceCurrency,
    p_fulfillment_type: fulfillmentType,
  });
}
