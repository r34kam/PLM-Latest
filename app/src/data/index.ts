// Data layer — ALL data access lives in this folder. Components import from '@/data'
// and never call a data hook directly.
//
// APP CODE MUST NOT USE THE PLATFORM ENTITY API. Not `/api/entity`, not
// `/api/aggregation`, and NONE of the entity hooks — useSearchEntities,
// useFindEntityById, useCreateEntity, useUpdateEntity, useDeleteEntity from
// '@unifyapps/app-builder-sdk/hooks/object'. Those exist for the AGENT at BUILD TIME
// (its create_object / create_record / query_records tools go the same way), authorized
// as the person running the build. A deployed app calling them is unauthorized, and its
// requests are invisible to the platform as things this app does.
//
// Reads:  useData(id, 'storage', { object, where, sort, limit }) from '@/lib/data'.
//         It executes the app's FETCH dataSource binding for you — whole stored input
//         set, filter shape, paging, envelope. It is ALSO what puts the binding in the
//         Data panel: the panel is extracted from useData() calls, so a read that goes
//         around it works and is invisible there.
// Writes: useExecuteWorkflowNodeMutation from
//         '@unifyapps/app-builder-sdk/hooks/workflow' with the CREATE / UPDATE / DELETE
//         bindings in './bindings'.
//
// The bindings are OBJECT-AGNOSTIC — the object is passed per call — so the five cover
// every object this app has. `provision_data_sources` mints them and writes their ids
// into ./bindings.ts; never type an id in by hand.
//
// One wrapper per object is defined HERE (useTickets, useUsers, … plus the mutation
// helpers). See the `object-data` skill.

export * from './bindings'
export * from './items'
export * from './admin'
export * from './bomItems'
export * from './changeOrders'
export * from './kitFiles'
export { useData } from '@/lib/data'
export type { StorageBinding, UseDataResult } from '@/lib/data'
