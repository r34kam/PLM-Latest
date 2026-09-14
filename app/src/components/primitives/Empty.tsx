import { T } from '@/theme/tokens'
import { Info } from 'lucide-react'

const Empty = ({ icon: Ic = Info, title, body, action }: { icon?: any; title?: React.ReactNode; body?: React.ReactNode; action?: React.ReactNode }) => (
  <div data-test-id="empty-state" style={{ padding: "34px 16px", textAlign: "center" }}>
    <Ic size={22} color={T.g400} />
    <div style={{ fontWeight: 600, marginTop: 8 }}>{title}</div>
    <div className="sub" style={{ marginTop: 4, maxWidth: 380, margin: "4px auto 0" }}>{body}</div>
    {action && <div style={{ marginTop: 12 }}>{action}</div>}
  </div>
);

export { Empty }


