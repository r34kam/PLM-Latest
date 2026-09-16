/**
 * Back-fill affectedAssembliesJson and inventoryDispositionJson on ALL
 * change-order records by fetching them through the platform entity API
 * and patching each one in-place.
 *
 * Run from the repo root:
 *   bun run scripts/backfill-eco-fields.ts
 */

import { deriveAffectedAssemblies, deriveInventoryDisposition } from '../app/src/domain/ecoDerivations'

const ENTITY_TYPE = 'change_order_e_6aa81a1f8136a3761d49b96a'
const API_BASE = 'http://127.0.0.1:8181'   // platform proxy always at this port

type BomEdit = { id: string; type: string; pn: string; name: string; qty: string; newValue: string }
type EcoItem = { pn: string; name: string; rev: string; cat: string; currentRev: string; newRev: string; bomEdits: BomEdit[] }
type Record = { id: string; properties: Record<string, string> }

async function fetchAll(): Promise<Record[]> {
  const all: Record[] = []
  let offset = 0
  const limit = 100
  while (true) {
    const body = {
      entityType: ENTITY_TYPE,
      paginateBy: 'OFFSET',
      limit,
      offset,
    }
    const res = await fetch(`${API_BASE}/api/entity/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const txt = await res.text()
      throw new Error(`fetchAll failed ${res.status}: ${txt}`)
    }
    const json = await res.json() as { objects: Record[]; hasMore: boolean }
    all.push(...json.objects)
    if (!json.hasMore || json.objects.length === 0) break
    offset += limit
  }
  return all
}

async function patchRecord(id: string, props: Record<string, string>): Promise<void> {
  const body = { id, entityType: ENTITY_TYPE, properties: props }
  const res = await fetch(`${API_BASE}/api/entity`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`patchRecord ${id} failed ${res.status}: ${txt}`)
  }
}

function parseItems(json: string | undefined): EcoItem[] {
  if (!json) return []
  try { return JSON.parse(json) as EcoItem[] } catch { return [] }
}

async function main() {
  console.log('Fetching all change-order records…')
  const records = await fetchAll()
  console.log(`Found ${records.length} records`)

  let patched = 0
  let skipped = 0

  for (const rec of records) {
    const p = rec.properties
    const coId = p.coId ?? rec.id

    // Skip if already filled
    if (p.affectedAssembliesJson && p.inventoryDispositionJson) {
      const aa = JSON.parse(p.affectedAssembliesJson)
      const inv = JSON.parse(p.inventoryDispositionJson)
      if (aa.length > 0 || inv.length > 0) {
        console.log(`  SKIP ${coId} — already has data`)
        skipped++
        continue
      }
    }

    const items = parseItems(p.ecoItemsJson)
    const kits = items.map((it) => ({ pn: it.pn, name: it.name, bomEdits: it.bomEdits ?? [] }))
    const affectedAssemblies = deriveAffectedAssemblies(kits)
    const inventoryDisposition = deriveInventoryDisposition(kits)

    console.log(`  PATCH ${coId} — ${affectedAssemblies.length} assemblies, ${inventoryDisposition.length} disposition rows`)
    await patchRecord(rec.id, {
      affectedAssembliesJson: JSON.stringify(affectedAssemblies),
      inventoryDispositionJson: JSON.stringify(inventoryDisposition),
    })
    patched++
  }

  console.log(`\nDone — ${patched} patched, ${skipped} skipped`)
}

main().catch((e) => { console.error(e); process.exit(1) })
