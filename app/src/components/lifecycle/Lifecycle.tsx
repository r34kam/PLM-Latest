// Sub-labels shown beneath certain stage names
const STAGE_SUB: Record<string, string> = {
  'Approval': 'Approvers',
  'Document Control': 'Document control',
}

const BRAND       = '#0A4F8F'
const REJECTED_BG = '#C0616A'

const Lifecycle = ({ stages, current, rejected }: {
  stages: string[]
  current: string
  rejected?: boolean
  sub?: number[]  // kept for API compat
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

        // Line to the right of this number: blue if this step is done, grey if upcoming
        const lineColor = isDone ? BRAND : '#E2E8F0'

        return (
          <div key={stage} style={{ display: 'flex', flexDirection: 'column' }} data-test-id={`lifecycle-stage-${k}`}>

            {/* ── Number badge + line going RIGHT ── */}
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', height: 26 }}>
              {/* Number: left-anchored */}
              {isCurrent ? (
                <div style={{
                  padding: '2px 7px', borderRadius: 6,
                  background: BRAND, color: '#fff',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.03em',
                  flexShrink: 0, lineHeight: '18px',
                }}>
                  {numLabel}
                </div>
              ) : (
                <div style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.03em',
                  color: isDone ? BRAND : '#B8C7D9',
                  flexShrink: 0, lineHeight: '18px',
                }}>
                  {numLabel}
                </div>
              )}

              {/* Line fills the rest of the cell (except last) */}
              {k < n - 1 && (
                <div style={{
                  flex: 1, height: 2, marginLeft: 8,
                  background: lineColor,
                  transition: 'background .3s',
                }} aria-hidden="true" />
              )}
            </div>

            {/* ── Labels: left-aligned directly below the number ── */}
            <div style={{ paddingTop: 8 }}>
              <div style={{
                fontSize: 13,
                fontWeight: isCurrent ? 700 : isDone ? 600 : 400,
                color: isUpcoming ? '#94a3b8' : '#0a2233',
              }}>
                {stage}
                {isRejected && (
                  <span style={{ fontSize: 10, color: REJECTED_BG, fontWeight: 600, marginLeft: 6 }}>Rejected</span>
                )}
              </div>
              {subLabel && (
                <div style={{
                  fontSize: 11, marginTop: 2,
                  color: isUpcoming ? '#B8C7D9' : '#64748b',
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


