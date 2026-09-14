import React from 'react'

const Kpi = ({ label, value, note, onClick, icon: Ic, extra, ...rest }: { label: string; value: React.ReactNode; note?: string; onClick?: () => void; icon?: any; extra?: React.ReactNode; [key: string]: any }) => (
  <button className="kpi" data-test-id="kpi-card" onClick={onClick}>
    <div className="kpi-head">
      <div className="l">{label}</div>
    </div>
    <div className="kpi-body">
      <div className="kpi-main">
        {Ic && (
          <span className="kicon">
            <Ic size={14} strokeWidth={2} />
          </span>
        )}
        <div className="v">{value}</div>
      </div>
      {extra && <div className="kpi-extra">{extra}</div>}
      {note && !extra && <div className="mini kpi-note" style={{ color: "#627d98", fontWeight: 500 }}>{note}</div>}
    </div>
  </button>
);

export { Kpi }


