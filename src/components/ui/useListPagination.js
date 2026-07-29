import { useMemo, useState } from "react";

export function useListPagination(items, pageSize, resetKey = "") {
  const [pagination, setPagination] = useState({
    page: 1,
    key: resetKey,
  });
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const requestedPage =
    pagination.key === resetKey ? pagination.page : 1;
  const currentPage = Math.min(requestedPage, totalPages);

  const pageItems = useMemo(
    () =>
      items.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize,
      ),
    [currentPage, items, pageSize],
  );

  return {
    pageItems,
    currentPage,
    totalPages,
    setPage: (page) => setPagination({ page, key: resetKey }),
  };
}
