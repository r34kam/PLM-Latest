import { T } from '@/theme/tokens'
import { Check, X } from 'lucide-react'

const BRAND = '#0A4F8F'
const DONE_BG = BRAND
const CURR_BG = BRAND
const TODO_BG = '#E3EAF2'
const REJECTED_BG = '#C0616A'

const Lifecycle = ({ stages, current, rejected }: { stages: string[]; current: string; rejected?: boolean; sub?: number[] }) => {
  const currentIdx = stages.indexOf(current);

  return (
    <div className="lcx" data-test-id="lifecycle-tracker">
      {stages.map((stage, k) => {
        const isDone = k < currentIdx;
        const isCurrent = k === currentIdx;
        const isRejected = isCurrent && Boolean(rejected);
        const isUpcoming = k > currentIdx;

        const nodeBg = isDone ? DONE_BG : isRejected ? REJECTED_BG : isCurrent ? CURR_BG : TODO_BG;
        const nodeSize = isCurrent ? 26 : 20;

        return (
          <div key={stage} className="lc-milestone" data-test-id={`lifecycle-stage-${k}`}>
            {/* Connector line before this node (except first) */}
            {k > 0 && (
              <div className="lc-connector" aria-hidden="true">
                <div className={`lc-line ${isDone || isCurrent ? 'lc-line-done' : ''}`} />
              </div>
            )}

            {/* Node + label */}
            <div className="lc-node-wrap">
              <div
                className="lc-node"
                style={{
                  width: nodeSize,
                  height: nodeSize,
                  borderRadius: '50%',
                  background: nodeBg,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  boxShadow: isCurrent ? `0 0 0 4px ${BRAND}26` : undefined,
                  transition: 'all .2s ease',
                  border: isUpcoming ? '2px solid #CBD5E1' : 'none',
                }}
              >
                {isDone && <Check size={10} color="#fff" strokeWidth={3.5} />}
                {isRejected && <X size={10} color="#fff" strokeWidth={3.5} />}
                {isCurrent && !isRejected && (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />
                )}
              </div>
              <div className="lc-label" style={{
                fontSize: 12,
                fontWeight: isCurrent ? 700 : isDone ? 500 : 400,
                color: isCurrent ? '#0a2233' : isDone ? '#334E68' : '#94a3b8',
                marginTop: 6,
                whiteSpace: 'nowrap',
              }}>
                {stage}
                {isRejected && (
                  <div style={{ fontSize: 10, color: REJECTED_BG, fontWeight: 600, marginTop: 1 }}>Rejected</div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export { Lifecycle }


