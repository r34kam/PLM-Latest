
const Card = ({ title, right, children, pad = true, sub, style }: any) => (
  <section className="card" data-test-id="card" style={{ minWidth: 0, ...style }}>
    {title && (
      <div className="ch">
        <div>
          <h2>{title}</h2>
          {sub && <div className="sub" style={{ marginTop: 2 }}>{sub}</div>}
        </div>
        <div style={{ marginLeft: "auto" }} className="row">{right}</div>
      </div>
    )}
    <div className={pad ? "cb" : ""}>{children}</div>
  </section>
);

export { Card }


