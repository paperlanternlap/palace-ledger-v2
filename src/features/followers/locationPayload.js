export function locationPayload(values, supportsMap) {
  const payload = {
    code: values.code,
    zone_number: values.zoneNumber,
    name: values.name,
    short_name: values.shortName,
    category: values.category,
    summary: values.summary || null,
    tags: values.tags,
    base_success_percent: values.baseSuccessPercent,
    active: values.active,
    sort_order: values.sortOrder,
  };
  if (supportsMap) {
    payload.map_label = values.mapLabel || null;
    payload.self_character_ids = values.selfCharacterIds || [];
  }
  return payload;
}

export function isMissingMapSchema(error) {
  return ["42703", "PGRST204"].includes(error?.code) &&
    /map_label|self_character_ids/.test(error?.message || "");
}
