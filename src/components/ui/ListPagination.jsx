import { ChevronLeft, ChevronRight } from "lucide-react";

export function ListPagination({
  currentPage,
  totalPages,
  onPageChange,
  label = "หน้ารายการ",
}) {
  if (totalPages <= 1) return null;

  return (
    <nav className="list-pagination" aria-label={label}>
      <button
        type="button"
        disabled={currentPage === 1}
        aria-label="หน้าก่อนหน้า"
        onClick={() => onPageChange(currentPage - 1)}
      >
        <ChevronLeft size={15} />
      </button>
      <span>
        {currentPage} / {totalPages}
      </span>
      <button
        type="button"
        disabled={currentPage === totalPages}
        aria-label="หน้าถัดไป"
        onClick={() => onPageChange(currentPage + 1)}
      >
        <ChevronRight size={15} />
      </button>
    </nav>
  );
}
