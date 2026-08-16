import { lazy, Suspense } from "react";

function lazyNamed(loader, exportName) {
  return lazy(() => loader().then((module) => ({ default: module[exportName] })));
}

const AcquisitionRequestQueue = lazyNamed(
  () => import("../../features/acquisition-requests/AcquisitionRequestQueue"),
  "AcquisitionRequestQueue",
);
const CharacterDetail = lazyNamed(
  () => import("../../features/characters/CharacterDetail"),
  "CharacterDetail",
);
const CharacterDirectory = lazyNamed(
  () => import("../../features/characters/CharacterDirectory"),
  "CharacterDirectory",
);
const FollowerManager = lazyNamed(
  () => import("../../features/followers/FollowerManager"),
  "FollowerManager",
);
const FollowerMissionQueue = lazyNamed(
  () => import("../../features/followers/FollowerMissionQueue"),
  "FollowerMissionQueue",
);
const InventoryManager = lazyNamed(
  () => import("../../features/inventory/InventoryManager"),
  "InventoryManager",
);
const ItemRequestQueue = lazyNamed(
  () => import("../../features/item-requests/ItemRequestQueue"),
  "ItemRequestQueue",
);
const StaffOverview = lazyNamed(
  () => import("../../features/overview/StaffOverview"),
  "StaffOverview",
);
const RpQueue = lazyNamed(
  () => import("../../features/rp-queue/RpQueue"),
  "RpQueue",
);

function CharacterWorkspace({ directory, detail }) {
  return (
    <section className="workspace min-h-0 flex-1">
      <CharacterDirectory {...directory} />
      <CharacterDetail {...detail} />
    </section>
  );
}

export function StaffPageContent({ activePage, onNavigate, characterWorkspace }) {
  let content;
  switch (activePage) {
    case "dashboard":
      content = <StaffOverview onNavigate={onNavigate} />;
      break;
    case "characters":
      content = <CharacterWorkspace {...characterWorkspace} />;
      break;
    case "rp-queue":
      content = <RpQueue />;
      break;
    case "item-requests":
      content = <ItemRequestQueue />;
      break;
    case "acquisition-requests":
      content = <AcquisitionRequestQueue />;
      break;
    case "exploration-missions":
      content = <FollowerMissionQueue />;
      break;
    case "followers":
      content = <FollowerManager />;
      break;
    case "inventory":
    default:
      content = <InventoryManager />;
  }

  return (
    <Suspense fallback={<div className="request-empty">กำลังเปิดหน้า...</div>}>
      {content}
    </Suspense>
  );
}
