import { Card } from '@/components/primitives/Card'
import { Empty } from '@/components/primitives/Empty'
import { Input, Select } from '@/components/primitives/Field'
import { FIELD_LIB, valFor } from '@/domain/reports'
import { downloadFile } from '@/lib/download'
import { T } from '@/theme/tokens'
import { ArrowRight, Check, Download, Filter, Layers, LayoutGrid, List, Plus, Search, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'

function ReportBuilder({ initialConfig }: any) {
  const [cols, setCols] = useState(initialConfig?.cols || ["Item number", "Item name", "Supplier name", "Manufacturer part number"]);
  const [filters, setFilters] = useState(initialConfig?.filters || [{ f: "Lifecycle phase", op: "is", v: "In Production" }]);
  const [group, setGroup] = useState(initialConfig?.group || []);
  const [sorts, setSorts] = useState(initialConfig?.sorts || [{ f: "Item number", dir: "Ascending" }]);
  const [q, setQ] = useState("");
  const [drag, setDrag] = useState<any>(null);
  const [addFilterField, setAddFilterField] = useState("");
  const [addGroupField, setAddGroupField] = useState("");

  const allFields = useMemo(() => {
    const list: any[] = [];
    FIELD_LIB.forEach((grp: any) => grp.f.forEach((f: any) => list.push(f)));
    return list;
  }, []);

  const used = (f: any) => cols.includes(f) || group.includes(f);

  const toggleField = (f: any) => {
    if (cols.includes(f)) {
      setCols(cols.filter((x: any) => x !== f));
    } else {
      setCols([...cols, f]);
    }
  };

  const dropTo = (target: any) => (e: any) => {
    e.preventDefault();
    const f = drag || e.dataTransfer.getData("text/plain");
    if (!f) return;
    if (target === "cols" && !cols.includes(f)) setCols([...cols, f]);
    if (target === "group" && !group.includes(f)) setGroup([...group, f]);
    if (target === "filters" && !filters.some((x: any) => x.f === f)) setFilters([...filters, { f, op: "is", v: "" }]);
    setDrag(null);
  };
  const allow = (e: any) => e.preventDefault();

  const Shelf = ({ title, hint, icon: Ic, target, children, count, extraHeader }: any) => (
    <div
      className="shelf"
      onDragOver={allow}
      onDrop={dropTo(target)}
      style={{
        border: "none",
        borderRadius: 10,
        background: "#f8fafc",
        overflow: "hidden"
      }}
    >
      <div
        className="shelfhead"
        style={{
          border: "none",
          background: "#f0f4f8"
        }}
      >
        <Ic size={13} />{title}<span className="n">{count}</span>
        {extraHeader}
        <span className="mini" style={{ marginLeft: "auto" }}>{hint}</span>
      </div>
      <div className="shelfbody">{children}</div>
    </div>
  );

  return (
    <div className="rb">
      <div
        className="rbfields"
        style={{
          border: "none"
        }}
      >
        <div className="bet" style={{ marginBottom: 8 }}>
          <b style={{ fontSize: 13, color: T.g800 }}>Field Library</b>
          {cols.length > 0 && (
            <button className="btn gh sm" style={{ height: 22, fontSize: 11, padding: "0 6px", color: T.bad }}
              onClick={() => setCols([])} title="Unselect all columns">
              <X size={11} />Clear all
            </button>
          )}
        </div>
        <div className="srch" style={{ margin: "0 0 12px" }}>
          <Search size={14} color={T.g500} />
          <input className="inp" style={{ width: "100%" }} placeholder="Find a field" value={q} onChange={(e: any) => setQ(e.target.value)} />
        </div>
        {FIELD_LIB.map((grp: any) => {
          const fs = grp.f.filter((f: any) => f.toLowerCase().includes(q.toLowerCase()));
          if (!fs.length) return null;
          return (
            <div key={grp.g} style={{ marginBottom: 14 }}>
              <div className="secthead">{grp.g}</div>
              {fs.map((f: any) => {
                const isSelected = cols.includes(f);
                return (
                  <div key={f} className={`fieldchip ${isSelected ? "on" : ""}`} draggable
                    onDragStart={(e: any) => { setDrag(f); e.dataTransfer.setData("text/plain", f); }}
                    onDragEnd={() => setDrag(null)}
                    onClick={() => toggleField(f)}
                    title={isSelected ? "Click to unselect / remove" : "Click to select / add"}>
                    <span className="grip"><List size={11} /></span>{f}
                    {isSelected ? (
                      <button className="chip-del" title="Remove" onClick={(e: any) => { e.stopPropagation(); toggleField(f); }}>
                        <X size={10} />
                      </button>
                    ) : (
                      used(f) && <Check size={12} color={T.ok} style={{ marginLeft: "auto" }} />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="rbmain">
        <Shelf title="Columns" hint="Drag fields here, or click one on the left" icon={LayoutGrid} target="cols" count={cols.length}>
          {cols.length ? cols.map((c: any) => (
            <span key={c} className="pill">{c}
              <button onClick={() => setCols(cols.filter((x: any) => x !== c))}><X size={11} /></button></span>
          )) : <span className="mini">No columns yet</span>}
        </Shelf>

        <Shelf title="Filters" hint="Narrow the rows" icon={Filter} target="filters" count={filters.length}
          extraHeader={
            <div className="row" style={{ marginLeft: 12, gap: 6 }} onClick={(e: any) => e.stopPropagation()}>
              <Select style={{ height: 26, width: 180, fontSize: 11 }} value={addFilterField}
                options={["+ Add filter field…", ...allFields.filter((f: any) => !filters.some((x: any) => x.f === f))]}
                onChange={(e: any) => {
                  const val = e.target.value;
                  if (val && val !== "+ Add filter field…") {
                    setFilters([...filters, { f: val, op: "is", v: "" }]);
                    setAddFilterField("");
                  }
                }} />
            </div>
          }>
          {filters.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 7, width: "100%" }}>
              {filters.map((f: any, k: any) => (
                <div key={k} className="filterrow">
                  <span className="pill static">{f.f}</span>
                  <Select style={{ width: 130, height: 28 }} value={f.op}
                    options={["is", "is not", "contains", "is empty", "is greater than"]}
                    onChange={(e: any) => { const n = [...filters]; n[k] = { ...f, op: e.target.value }; setFilters(n); }} />
                  <Input style={{ height: 28, width: 190 }} value={f.v} placeholder="Value"
                    onChange={(e: any) => { const n = [...filters]; n[k] = { ...f, v: e.target.value }; setFilters(n); }} />
                  <button className="btn gh sm" title="Remove filter" onClick={() => setFilters(filters.filter((_: any, j: any) => j !== k))}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          ) : <span className="mini">No filters — every row is returned</span>}
        </Shelf>

        <div className="grid2">
          <Shelf title="Group by" hint="Optional grouping" icon={Layers} target="group" count={group.length}
            extraHeader={
              <div className="row" style={{ marginLeft: 12, gap: 6 }} onClick={(e: any) => e.stopPropagation()}>
                <Select style={{ height: 26, width: 160, fontSize: 11 }} value={addGroupField}
                  options={["+ Add group field…", ...allFields.filter((f: any) => !group.includes(f))]}
                  onChange={(e: any) => {
                    const val = e.target.value;
                    if (val && val !== "+ Add group field…") {
                      setGroup([...group, val]);
                      setAddGroupField("");
                    }
                  }} />
              </div>
            }>
            {group.length ? group.map((c: any) => (
              <span key={c} className="pill">{c}
                <button onClick={() => setGroup(group.filter((x: any) => x !== c))}><X size={11} /></button></span>
            )) : <span className="mini">Flat list — select or drag fields to group</span>}
          </Shelf>

          <div
            className="shelf"
            style={{
              border: "none",
              borderRadius: 10,
              background: "#f8fafc",
              overflow: "hidden"
            }}
          >
            <div
              className="shelfhead"
              style={{
                border: "none",
                background: "#f0f4f8"
              }}
            >
              <ArrowRight size={13} />Sort
              <span className="n">{sorts.length}</span>
              <button className="btn sm gh" style={{ marginLeft: 12, height: 24, fontSize: 11 }}
                onClick={() => {
                  const available = (cols.length ? cols : allFields).find((f: any) => !sorts.some((s: any) => s.f === f)) || "Item number";
                  setSorts([...sorts, { f: available, dir: "Ascending" }]);
                }}>
                <Plus size={11} />Add sort
              </button>
            </div>
            <div className="shelfbody" style={{ flexDirection: "column", alignItems: "stretch", gap: 7 }}>
              {sorts.map((st: any, sidx: any) => (
                <div key={sidx} className="row" style={{ gap: 8, width: "100%" }}>
                  <span className="mini" style={{ width: 44 }}>{sidx === 0 ? "Sort by" : "Then by"}</span>
                  <Select style={{ height: 28, flex: 1 }} value={st.f}
                    options={cols.length ? cols : allFields}
                    onChange={(e: any) => {
                      const next = [...sorts];
                      next[sidx] = { ...st, f: e.target.value };
                      setSorts(next);
                    }} />
                  <Select style={{ height: 28, width: 125 }} value={st.dir} options={["Ascending", "Descending"]}
                    onChange={(e: any) => {
                      const next = [...sorts];
                      next[sidx] = { ...st, dir: e.target.value };
                      setSorts(next);
                    }} />
                  {sorts.length > 1 && (
                    <button className="btn gh sm" title="Remove sort" onClick={() => setSorts(sorts.filter((_: any, j: any) => j !== sidx))}>
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <Card
          title="Preview"
          pad={false}
          right={<div className="row" style={{ alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11, color: "#627d98" }}>
              {`${cols.length} column${cols.length === 1 ? "" : "s"} · ${filters.length} filter${filters.length === 1 ? "" : "s"} · ${sorts.length} sort${sorts.length === 1 ? "" : "s"} · 6 of 1,284 rows`}
            </span>
            <button className="btn sm">Save report</button>
            <button className="btn sm pri" onClick={() => downloadFile("topcon-report.csv",
              cols.join(",") + "\n" + [0, 1, 2, 3, 4, 5].map((k: any) => cols.map((c: any) => valFor(c, k)).join(",")).join("\n"))}>
              <Download size={12} />Export</button>
          </div>}
        >
          {cols.length === 0 ? (
            <Empty icon={LayoutGrid} title="Pick some columns"
              body="Drag a field from the left onto the Columns shelf, or click it." />
          ) : (
            <div className="scrollx">
              <table className="tbl">
                <thead><tr>{cols.map((c: any) => <th key={c} style={{ borderBottom: "1px solid #d9e2ec" }}>{c}</th>)}</tr></thead>
                <tbody>
                  {[0, 1, 2, 3, 4, 5].map((k: any) => (
                    <tr key={k}>{cols.map((c: any, j: any) => (
                      <td key={c} className={j === 0 ? "pn" : ""} style={{ borderBottom: "1px solid #d9e2ec" }}>{valFor(c, k)}</td>
                    ))}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export { ReportBuilder }


