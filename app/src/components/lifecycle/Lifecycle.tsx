// Sub-labels shown beneath certain stage names
const STAGE_SUB: Record<string, string> = {
  'Approval': 'Approvers',
}

const BRAND       = '#0A4F8F'
const REJECTED_BG = '#C0616A'

const Lifecycle = ({ stages, current, rejected }: {
  stages: string[]
  current: string
  rejected?: boolean
  sub?: number[]  // kept for API compat, unused now stages are discrete
}) => {
  const currentIdx = stages.indexOf(current)
  const n = stages.length

  return (
    <div
      className="lcx"
      style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, width: '100%', alignItems: 'start' }}
      data-test-id="lifecycle-tracker"
    >
      {stages.map((stage, k) => {
        const isDone     = k < currentIdx
        const isCurrent  = k === currentIdx
        const isRejected = isCurrent && Boolean(rejected)
        const isUpcoming = k > currentIdx
        const numLabel   = String(k + 1).padStart(2, '0')
        const subLabel   = STAGE_SUB[stage]

        // Connector colours: segment left of this node is done-coloured if this or a prior step is active
        const leftDone  = k > 0 && (isDone || isCurrent)
        const rightDone = k < n - 1 && isDone

        return (
          <div key={stage} style={{ display: 'flex', flexDirection: 'column' }} data-test-id={`lifecycle-stage-${k}`}>

            {/* ── Number + solid line row ── */}
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', height: 28 }}>
              {/* Left connector */}
              <div style={{
                flex: 1, height: 2,
                background: k === 0 ? 'transparent' : leftDone ? BRAND : '#E2E8F0',
                transition: 'background .3s',
              }} aria-hidden="true" />

              {/* Number badge */}
              {isCurrent ? (
                <div style={{
                  padding: '2px 8px', borderRadius: 6,
                  background: BRAND, color: '#fff',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                  flexShrink: 0, lineHeight: '18px',
                }}>
                  {numLabel}
                </div>
              ) : (
                <div style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                  color: isDone ? BRAND : '#CBD5E1',
                  flexShrink: 0, lineHeight: '18px',
                  minWidth: 20, textAlign: 'center',
                }}>
                  {numLabel}
                </div>
              )}

              {/* Right connector */}
              <div style={{
                flex: 1, height: 2,
                background: k === n - 1 ? 'transparent' : rightDone ? BRAND : '#E2E8F0',
                transition: 'background .3s',
              }} aria-hidden="true" />
            </div>

            {/* ── Label row ── */}
            <div style={{ paddingTop: 8, paddingLeft: 0 }}>
              <div style={{
                fontSize: 13,
                fontWeight: isCurrent ? 700 : isDone ? 600 : 400,
                color: isUpcoming ? '#94a3b8' : '#0a2233',
                whiteSpace: 'nowrap',
              }}>
                {stage}
                {isRejected && (
                  <span style={{ fontSize: 10, color: REJECTED_BG, fontWeight: 600, marginLeft: 6 }}>Rejected</span>
                )}
              </div>
              {subLabel && (
                <div style={{
                  fontSize: 11, marginTop: 1,
                  color: isUpcoming ? '#cbd5e1' : '#64748b',
                }}>
                  {subLabel}
                </div>
              )}
            </div>

          </div>
        )
      })}
    </div>
  )
}

export { Lifecycle }


