/**
 * Computes affectedAssembliesJson and inventoryDispositionJson for all known
 * change-order records and prints the update payloads.
 *
 * Run from the repo root:
 *   bun run scripts/backfill-eco-fields.ts
 */

import { deriveAffectedAssemblies, deriveInventoryDisposition } from '../app/src/domain/ecoDerivations'

type BomEdit = { id: string; type: string; pn: string; name: string; qty: string; newValue: string }
type EcoItem = { pn: string; name: string; rev: string; cat: string; currentRev: string; newRev: string; bomEdits: BomEdit[] }

function parseItems(ecoItemsJson: string): EcoItem[] {
  try { return JSON.parse(ecoItemsJson) } catch { return [] }
}

// All known backend records with their current ecoItemsJson
const records: Array<{ id: string; coId: string; ecoItemsJson: string }> = [
  {
    id: 'e_6aa82936ac295b22cecc9959',
    coId: 'DCO-008310',
    ecoItemsJson: JSON.stringify([{
      pn: '1007886-02', name: 'ASSY, GNSS ANTENNA MOUNT', rev: 'C', cat: 'Production', currentRev: 'C', newRev: 'D',
      bomEdits: [
        { id: 'e1', type: 'DELETE', pn: 'SCR-M6-04', name: 'SCR M6x16', qty: '4 EA', newValue: '' },
        { id: 'e2', type: 'ADD',    pn: 'SCR-M6-04', name: 'SCR M6x16', qty: '6 EA', newValue: '' },
      ],
    }]),
  },
  {
    id: 'e_6aa82936ac295b22cecc9958',
    coId: 'ECO-011310',
    ecoItemsJson: JSON.stringify([{
      pn: '05-080401-01LF', name: 'ASSY, FLASH GORDON LNA PCB', rev: 'B', cat: 'Production', currentRev: 'B', newRev: 'C',
      bomEdits: [
        { id: 'e1', type: 'UPDATE_DESC', pn: '05-080401-01LF', name: 'ASSY, FLASH GORDON LNA PCB', qty: '', newValue: 'RoHS compliant components per updated AML' },
      ],
    }]),
  },
  {
    id: 'e_6aaa8ebeeb493f7af69437a7',
    coId: 'ECO-000055',
    ecoItemsJson: JSON.stringify([{
      pn: 'ATP-SHC5000-007', name: 'TEST PROC SHC5000 OUTPUT', rev: 'D', cat: 'Quality', currentRev: 'D', newRev: 'E',
      bomEdits: [],
    }]),
  },
  {
    id: 'e_6aaacf2ed3c29c312c398d66',
    coId: 'ECO-051487',
    ecoItemsJson: JSON.stringify([{
      pn: '1007886-02', name: 'ASSY, GNSS ANTENNA MOUNT', rev: 'F', cat: 'ASSEMBLY', currentRev: 'F', newRev: 'G',
      bomEdits: [
        { id: 'seed-1', type: 'ADD', pn: '1006477-02', name: 'BKT,TS-I3 STRAIN RELIEF', qty: '4 EA', newValue: '' },
      ],
    }]),
  },
]

for (const rec of records) {
  const items = parseItems(rec.ecoItemsJson)
  const kits = items.map((it) => ({ pn: it.pn, name: it.name, bomEdits: it.bomEdits }))
  const affectedAssemblies = deriveAffectedAssemblies(kits)
  const inventoryDisposition = deriveInventoryDisposition(kits)

  console.log(`\n=== ${rec.coId} (${rec.id}) ===`)
  console.log(`affectedAssembliesJson (${affectedAssemblies.length} rows):`)
  console.log(JSON.stringify(affectedAssemblies))
  console.log(`inventoryDispositionJson (${inventoryDisposition.length} rows):`)
  console.log(JSON.stringify(inventoryDisposition))
}
