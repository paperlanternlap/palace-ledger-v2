import { STATUS_STYLES } from "./constants";

export function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
        STATUS_STYLES[status] || STATUS_STYLES["ถอนตัวละคร"]
      }`}
    >
      {status || "ไม่ระบุสถานะ"}
    </span>
  );
}
