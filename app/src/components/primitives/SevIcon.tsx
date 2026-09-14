import { T } from '@/theme/tokens'
import { AlertTriangle, Check, X } from 'lucide-react'

const SevIcon = ({ sev, size = 14 }: any) =>
  sev === "ok" ? <Check size={size} color={T.ok} strokeWidth={3} />
  : sev === "warn" ? <AlertTriangle size={size} color={T.warn} />
  : <X size={size} color={T.bad} strokeWidth={3} />;

export { SevIcon }


