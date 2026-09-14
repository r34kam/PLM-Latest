
const Tabs = ({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) => (
  <div className="tabs" data-test-id="tabs-container" style={{ border: "none", borderBottom: "none" }}>
    {tabs.map((t: any) => (
      <button key={t} className={`tab ${active === t ? "on" : ""}`} data-test-id={`tab-${t.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} onClick={() => onChange(t)}>{t}</button>
    ))}
  </div>
);

export { Tabs }


