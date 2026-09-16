import TopconPLM from '@/TopconPLM'
import { useSearchParams } from 'react-router-dom'

export default function Admin() {
  const [searchParams] = useSearchParams()
  const tab = searchParams.get('tab') ?? undefined
  return <TopconPLM initialPage="admin" initialTab={tab} />
}
