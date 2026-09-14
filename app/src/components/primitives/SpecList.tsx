import React from 'react'

  const SpecList = ({ rows }: any) => (
    <dl className="spec">
      {rows.map(([k, v]: any) => (
        <React.Fragment key={typeof k === "string" ? k : Math.random()}>
          <dt>{k}</dt>
          <dd>{v || <span className="mut">—</span>}</dd>
        </React.Fragment>
      ))}
    </dl>
  );

export { SpecList }


