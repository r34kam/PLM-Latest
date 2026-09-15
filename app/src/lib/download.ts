
/* ========================= SHARED PATTERNS ========================== */

const downloadFile = (name: any, content: any, type: any = "text/csv;charset=utf-8") => {
  try {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (e) { /* download unavailable in this frame */ }
};

/**
 * Download an array of objects as an Excel .xlsx file.
 * Uses XLSX.write with type:'array' (browser-safe — no Node fs required).
 */
async function downloadExcel(filename: string, rows: Record<string, unknown>[], sheetName = 'Sheet1') {
  try {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    // write to a Uint8Array — browser-safe, no fs dependency
    const buf: ArrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadFile(filename, buf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  } catch (e) {
    console.error('Excel export failed', e);
  }
}

export { downloadFile, downloadExcel }


