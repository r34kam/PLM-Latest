import { T } from '@/theme/tokens'
import { X } from 'lucide-react'
import React from 'react'

function InterpretationChips({
  chips,
  onRemove,
  onClear,
  style,
}: {
  chips: Array<{ id: string; label: string; join?: string }>;
  onRemove?: (id: string) => void;
  onClear?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ padding: "11px 16px", border: "none", borderBottom: "none", background: T.b25, borderRadius: 10, ...style }}>
      <div className="bet" style={{ marginBottom: 7 }}>
        <div className="mini">Interpreted as</div>
        {onClear && (
          <button type="button" className="btn gh sm" style={{ height: 18, padding: "0 4px", fontSize: 11 }} onClick={onClear}>Clear</button>
        )}
      </div>
      <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
        {chips.map((c: any) => (
          <React.Fragment key={c.id}>
            {c.join && <span className="mini">{c.join}</span>}
            <span className="pill" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span>{c.label}</span>
              {onRemove && (
                <button
                  type="button"
                  title={`Remove ${c.label}`}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    background: T.b100,
                    color: T.brand,
                    cursor: "pointer",
                    padding: 0,
                    border: "none",
                  }}
                  onClick={() => onRemove(c.id)}
                >
                  <X size={10} strokeWidth={2.5} />
                </button>
              )}
            </span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export { InterpretationChips }


