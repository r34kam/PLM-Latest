import { ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 10;
function Pagination({ total, page, setPage }: { total: number; page: number; setPage: (p: number) => void }) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) return null;
  const start = page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, total);
  const pageNums: (number | "…")[] = [];
  for (let i = 0; i < totalPages; i++) {
    if (i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 1) pageNums.push(i);
    else if (pageNums[pageNums.length - 1] !== "…") pageNums.push("…");
  }
  return (
    <div className="pagn" data-test-id="pagination">
      <span className="pagn-info">Showing {start}–{end} of {total}</span>
      <div className="pagn-btns">
        <button className="pagn-btn" data-test-id="pagn-prev" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous page">
          <ChevronLeft size={13} />
        </button>
        {pageNums.map((n: any, i: any) => n === "…"
          ? <span key={`e${i}`} className="pagn-info" style={{ padding: "0 4px" }}>…</span>
          : <button key={n} className={`pagn-btn ${n === page ? "on" : ""}`} data-test-id={`pagn-page-${n}`} onClick={() => setPage(n as number)}>{(n as number) + 1}</button>
        )}
        <button className="pagn-btn" data-test-id="pagn-next" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)} aria-label="Next page">
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}

export { PAGE_SIZE, Pagination }


