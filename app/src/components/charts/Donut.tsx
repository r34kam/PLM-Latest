import { T } from '@/theme/tokens'

const Donut = ({ data, size = 168 }: any) => {
  const total = data.reduce((a: any, b: any) => a + b.v, 0) || 1;
  const r = size / 2 - 14, c = 2 * Math.PI * r;
  let off = 0;
  return (
    <div>
      <div style={{ display: "grid", placeItems: "center", position: "relative", height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          {data.map((d: any) => {
            const len = (d.v / total) * c;
            const el = <circle key={d.k} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.c} strokeWidth={20}
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off} />;
            off += len; return el;
          })}
        </svg>
        <div style={{ position: "absolute", textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-.03em", fontVariantNumeric: "tabular-nums" }}>{total}</div>
          <div className="mini">changes</div>
        </div>
      </div>
      <div className="legend">
        {data.map((d: any) => <span key={d.k}><i className="sw" style={{ background: d.c }} />{d.k} <b style={{ color: T.g900, fontVariantNumeric: "tabular-nums" }}>{d.v}</b></span>)}
      </div>
    </div>
  );
};

export { Donut }


