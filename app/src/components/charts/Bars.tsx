import { T } from '@/theme/tokens'

/* ---------------------------- charts ---------------------------- */

const Bars = ({ data, height = 168 }: any) => {
  const max = Math.max(...data.map((d: any) => d.v), 1);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height, padding: "0 2px" }}>
        {data.map((d: any) => (
          <div key={d.k} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: T.g700, fontVariantNumeric: "tabular-nums" }}>{d.v}</span>
            <div title={`${d.k}: ${d.v}`} style={{
              width: "100%", maxWidth: 54, height: `${Math.max((d.v / max) * 100, 3)}%`,
              background: d.c, borderRadius: "6px 6px 0 0", transition: "height .3s ease"
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 9, border: "none", paddingTop: 8 }}>
        {data.map((d: any) => (
          <div key={d.k} style={{ flex: 1, textAlign: "center", fontSize: 11, color: "#737373", fontWeight: 400 }}>{d.k}</div>
        ))}
      </div>
    </div>
  );
};

export { Bars }


