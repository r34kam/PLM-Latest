import TopconPLM from '@/TopconPLM'
import { useSearchParams } from 'react-router-dom'

export default function InactivatePage() {
  const [params] = useSearchParams()
  const id = params.get('id') || '01-080401-03'
  return <TopconPLM initialPage="inactivate" initialId={id} />
}
