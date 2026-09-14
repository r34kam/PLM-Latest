import { T } from '@/theme/tokens'
import { Check, X } from 'lucide-react'

const Lifecycle = ({ stages, current, rejected, sub = [60, 0] }: any) => {
  const i = stages.indexOf(current);
  return (
    <div className="lcx" data-test-id="lifecycle-tracker">
      {stages.map((st: any, k: any) => {
        const state = k < i ? "done" : k === i ? "now" : "";
        const isDone = k < i;
        const isCurrent = k === i;
        const isRejected = isCurrent && Boolean(rejected);
        const bg = isDone ? T.brand : isRejected ? "#C0616A" : isCurrent ? T.brand : "#E3EAF2";
        const segs = st === "Approval" ? 2 : 1;
        return (
          <div key={st} className={`lcs ${state}`}>
            <div className="top">
              <span className="lbl2">{st}</span>
              <span
                className="circ"
                style={{
                  width: 21,
                  height: 21,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  flex: "none",
                  backgroundColor: bg,
                  background: bg,
                  border: "none",
                }}
              >
                {isDone && <Check size={11} color="#fff" strokeWidth={4} />}
                {isRejected && <X size={11} color="#fff" strokeWidth={4} />}
              </span>
            </div>
            <div className="bars">
              {Array.from({ length: segs }).map((_: any, j: any) => {
                const fill = k < i ? 100 : k > i ? 0 : segs === 2 ? sub[j] : 50;
                return <span key={j} className="bseg"><i style={{ width: `${fill}%`, background: T.brand }} /></span>;
              })}
            </div>
            {st === "Approval" && k === i && (
              <div className="submarks"><span>Approvers</span><span>Document control</span></div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export { Lifecycle }


