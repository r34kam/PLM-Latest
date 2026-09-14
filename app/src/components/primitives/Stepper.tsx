import { Check } from 'lucide-react'
import React from 'react'

const Stepper = ({ steps, i }: any) => (
  <div className="steps" data-test-id="stepper">
    {steps.map((s: any, k: any) => (
      <React.Fragment key={s}>
        {k > 0 && <div className="stpline" />}
        <div className={`stp ${k === i ? "on" : k < i ? "dn" : ""}`}>
          <span className="n">{k < i ? <Check size={11} strokeWidth={3} color="#fff" /> : k + 1}</span>{s}
        </div>
      </React.Fragment>
    ))}
  </div>
);

export { Stepper }


