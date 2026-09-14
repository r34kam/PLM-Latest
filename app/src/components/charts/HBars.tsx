
const HBars = ({ data }: any) => {
  const max = Math.max(...data.map((d: any) => d.v), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      {data.map((d: any) => (
        <div key={d.k}>
          <div className="bet" style={{ marginBottom: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 400 }}>{d.k}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: d.c, fontVariantNumeric: "tabular-nums" }}>{d.v}</span>
          </div>
          <div className="hbar"><i style={{ width: `${(d.v / max) * 100}%`, background: d.c }} /></div>
        </div>
      ))}
    </div>
  );
};

export { HBars }


