import { T } from '@/theme/tokens'
import { Check, X } from 'lucide-react'

function CompactInspectStageList({ stages, current, rejected }: { stages: string[]; current: string; rejected?: boolean }) {
  const curIdx = stages.indexOf(current);

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 10, padding: "4px 2px" }}
      data-test-id="compact-inspect-stage-list"
    >
      {stages.map((st: any, idx: any) => {
        const isDone = idx < curIdx;
        const isCurrent = idx === curIdx;
        const isRejected = isCurrent && Boolean(rejected);

        return (
          <div
            key={st}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
              fontWeight: isCurrent ? 600 : 400,
              color: isCurrent ? T.g950 : isDone ? T.g800 : T.g600,
            }}
            data-test-id={`compact-stage-${st.toLowerCase()}`}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                backgroundColor: isDone ? "#35A65B" : isRejected ? "#C0616A" : isCurrent ? "#0A4F8F" : "#E3EAF2",
                background: isDone ? "#35A65B" : isRejected ? "#C0616A" : isCurrent ? "#0A4F8F" : "#E3EAF2",
                border: "none",
              }}
            >
              {isDone && <Check size={11} color="#fff" strokeWidth={3.5} />}
              {isRejected && <X size={11} color="#fff" strokeWidth={3.5} />}
            </div>
            <span style={{ lineHeight: 1.2 }}>{st}</span>
          </div>
        );
      })}
    </div>
  );
}

export { CompactInspectStageList }


