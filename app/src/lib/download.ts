
/* ========================= SHARED PATTERNS ========================== */

const downloadFile = (name: any, content: any, type: any = "text/csv;charset=utf-8") => {
  try {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (e) { /* download unavailable in this frame */ }
};

export { downloadFile }


