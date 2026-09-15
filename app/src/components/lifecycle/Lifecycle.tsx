import { Check, X } from 'lucide-react'

const BRAND       = '#0A4F8F'
const REJECTED_BG = '#C0616A'
const TODO_BG     = '#E3EAF2'

// Sub-states shown beneath the Approval milestone
const APPROVAL_SUB = ['Approvers', 'Doc control'] as const

const Lifecycle = ({ stages, current, rejected, sub = [60, 0] }: {
  stages: string[]
  current: string
  rejected?: boolean
  sub?: number[]
}) => {
  const currentIdx = stages.indexOf(current)

  return (
    // Grid: one equal column per stage, so spacing is always even
    <div
      className="lcx"
      style={{ display: 'grid', gridTemplateColumns: `repeat(${stages.length}, 1fr)`, width: '100%', alignItems: 'start' }}
      data-test-id="lifecycle-tracker"
    >
      {stages.map((stage, k) => {
        const isDone     = k < currentIdx
        const isCurrent  = k === currentIdx
        const isRejected = isCurrent && Boolean(rejected)
        const isUpcoming = k > currentIdx
        const isApproval = stage === 'Approval'

        const nodeBg   = isDone ? BRAND : isRejected ? REJECTED_BG : isCurrent ? BRAND : TODO_BG
        const nodeSize = isCurrent ? 26 : 20

        // For Approval sub-states: first sub done if approvers approved
        const approversPct  = sub[0] ?? 0
        const docControlPct = sub[1] ?? 0

        return (
          <div key={stage} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} data-test-id={`lifecycle-stage-${k}`}>

            {/* ── Row with connector + node ── */}
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', position: 'relative' }}>
              {/* Left half-connector */}
              <div style={{ flex: 1, height: 0, borderTop: `2px dashed ${k === 0 ? 'transparent' : (isDone || isCurrent) ? BRAND : '#CBD5E1'}` }} aria-hidden="true" />

              {/* Node */}
              <div
                style={{
                  width: nodeSize, height: nodeSize, borderRadius: '50%',
                  background: nodeBg,
                  display: 'grid', placeItems: 'center', flexShrink: 0,
                  boxShadow: isCurrent ? `0 0 0 4px ${BRAND}26` : undefined,
                  transition: 'all .2s ease',
                  border: isUpcoming ? '2px solid #CBD5E1' : 'none',
                }}
              >
                {isDone     && <Check size={10} color="#fff" strokeWidth={3.5} />}
                {isRejected && <X    size={10} color="#fff" strokeWidth={3.5} />}
                {isCurrent && !isRejected && (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />
                )}
              </div>

              {/* Right half-connector */}
              <div style={{ flex: 1, height: 0, borderTop: `2px dashed ${k === stages.length - 1 ? 'transparent' : isDone ? BRAND : '#CBD5E1'}` }} aria-hidden="true" />
            </div>

            {/* ── Stage label ── */}
            <div style={{
              fontSize: 12, marginTop: 6, textAlign: 'center', whiteSpace: 'nowrap',
              fontWeight: isCurrent ? 700 : isDone ? 500 : 400,
              color: isCurrent ? '#0a2233' : isDone ? '#334E68' : '#94a3b8',
            }}>
              {stage}
              {isRejected && (
                <div style={{ fontSize: 10, color: REJECTED_BG, fontWeight: 600, marginTop: 1 }}>Rejected</div>
              )}
            </div>

            {/* ── Approval sub-states ── */}
            {isApproval && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8, width: '90%' }}>
                {APPROVAL_SUB.map((label, j) => {
                  const pct     = j === 0 ? approversPct : docControlPct
                  const subDone = isDone || pct === 100
                  const subActive = isCurrent && pct > 0 && pct < 100
                  const subColor = subDone ? BRAND : subActive ? BRAND : '#CBD5E1'
                  return (
                    <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      {/* Mini progress bar */}
                      <div style={{ width: '100%', height: 3, borderRadius: 2, background: '#E3EAF2', overflow: 'hidden' }}>
                        <div style={{ width: `${isDone ? 100 : pct}%`, height: '100%', background: subColor, borderRadius: 2, transition: 'width .4s ease' }} />
                      </div>
                      <div style={{ fontSize: 10, color: subDone ? '#334E68' : '#94a3b8', fontWeight: subDone ? 600 : 400, whiteSpace: 'nowrap' }}>
                        {label}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

          </div>
        )
      })}
    </div>
  )
}

export { Lifecycle }


