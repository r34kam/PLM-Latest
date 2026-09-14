---
name: backend-integration
description: How to build an app whose data lives in the backend (durable, shared records) instead of localStorage. Covers the build-time flow (create_object / create_records tools) and the runtime CRUD in the generated app, which goes through four dataSource bindings executed via @unifyapps/app-builder-sdk/hooks/workflow — NEVER the entity API. MANDATORY whenever the plan says the app is BACKEND-STITCHED — load this BEFORE calling any entity tool or writing any data-access code. Authentication (login pages, making an app public) is a SEPARATE concern — see the `authentication` skill.
version: 2
---

# Backend integration — data in objects, not localStorage

Load and follow this skill whenever the plan says the app is **backend-stitched**.
The rule: **all app data lives in backend objects** — never hard-coded in the UI and
never persisted to localStorage. Two halves work together:

- **Build time (you, the agent):** the `create_object` and `create_records` tools
  provision the backend — an object (schema) and its seed rows. `create_object`
  returns the object's **`entityType`** name (a slug, e.g. `ticket`). ALWAYS give
  the object a `description` (its purpose, 1-2 sentences) and every schema field a
  help-text `description` (what it holds, expected format/values) — they show in
  the backend UI.
- **Runtime (the app you write):** the app does CRUD by executing four **dataSource
  bindings** (`provision_data_sources`), targeting that same `entityType` as the
  `object_type` input. It must NEVER call the platform entity API — not
  `/api/entity`, not `/api/aggregation`, and none of the `hooks/object` entity hooks.
  Those are build-time tools authorized as the person running the build; a deployed
  app calling them is unauthorized. See "The four bindings".

Only use this when the plan wants **durable / shared** data. For purely local UI
state, keep using the zustand store.

## Setup — already wired

- `@unifyapps/app-builder-sdk` resolves out of the box (no install step) — the
  template vendors the SDK under `src/@unifyapps/app-builder-sdk` and aliases the
  specifier to it. Always import via the `@unifyapps/app-builder-sdk` specifier;
  never reach into the vendored files by their internal path.
- The template's `main.tsx` already wraps the app in `<AppBuilderProvider>`, which
  mounts TanStack Query for the hooks. **Do not** add another QueryClient/provider
  and do not edit `main.tsx` for this.

## Where the data layer lives — `src/data/`

Every call goes through **`src/data/`**. One wrapper per object (`useTickets`,
`useCreateTicket`, …); components import from `@/data` and never call a hook
directly. The dataSource ids live there as module constants, in ONE place.

## The four bindings

The app does **not** talk to the entity API. It executes four saved **dataSource**
bindings — `provision_data_sources` mints them once per app and returns their ids:

| binding | hook | overridable `inputs` |
| --- | --- | --- |
| fetch | `useExecuteWorkflowNode` | `object_type`, `triggerInputCondition`, `page`, `sortBy`, `fields`, `searchField` |
| create | `useExecuteWorkflowNodeMutation` | `object_type`, `rawPayload` |
| update | `useExecuteWorkflowNodeMutation` | `object_type`, `recordId`, `rawPayload` |
| delete | `useExecuteWorkflowNodeMutation` | `object_type`, `entityId` |

The bindings are **object-agnostic** — `object_type` is passed per call — so these
four cover every object the app has.

### Two rules, both verified against a live environment

**1. Send the WHOLE stored input set on every call.** `provision_data_sources`
returns each binding's `storedInputs` — spread them and override only what varies:

```ts
inputs: { ...FETCH.storedInputs, object_type: TICKET, page, sortBy, triggerInputCondition }
```

A subset is rejected with `forbidden datasource : invalid input` — **even a subset
made only of overridable fields**. Never hand-list the literals; spread
`storedInputs` so they cannot drift.

**2. Only the listed inputs may DIFFER from what was stored.** Give a non-listed
field a different value and you get the same error. `{{ }}` decides what you may
*change*, not what you may *omit*.

The `context` on every call is `{ appName, resourceName }` — both come back from
`provision_data_sources`. Omit them and it is `forbidden datasource` again.

Import from **`@unifyapps/app-builder-sdk/hooks/workflow`**. Never the bare
`executeWorkflowNode` function — it carries no `x-ua-app` header and the backend
rejects it in preview and deployed alike.

## A read

```ts
// src/data/tickets.ts
import { useExecuteWorkflowNode } from '@unifyapps/app-builder-sdk/hooks/workflow'

// from provision_data_sources — never hand-written
const FETCH = { id: 'e_...', context: { appName: '...', resourceName: '...' }, storedInputs: {/* … */} }
const TICKET = 'ticket_<sessionId>'   // the entityType create_object returned

export function useTickets(status?: string) {
  return useExecuteWorkflowNode({
    id: FETCH.id,
    context: FETCH.context,
    inputs: {
      ...FETCH.storedInputs,            // ALWAYS — a subset is refused
      object_type: TICKET,
      // filter — parameterize the wrapper, never fetch-all-then-.filter()
      triggerInputCondition: status
        ? { operator: 'AND', filters: [
            { property: 'properties.status', filter: { operator: 'EQUAL', value: status } },
          ] }
        : {},                            // {} = no filter, but still send the key
      sortBy: [{ field: 'properties.createdAt', order: 'DESC' }],
      page: { paginateBy: 'OFFSET', limit: 20, offset: 0 },
    },
  })
}
```

**The filter shape is not the entity API's.** It is
`{ operator, filters: [{ property, filter: { operator, value } }] }` — singular
`value`; a `values` array errors the workflow. The entity API's `{op, field, values}`
is accepted here with a **200 and ignored**: verified live, it returned all 32 records
instead of the 8 that matched. There is no error to read, so this shape is not
negotiable.

**Field paths:** the record id is `id`; every schema field is `properties.<key>`.
A bare `status` is accepted and matches nothing.

## A write

```ts
import { useExecuteWorkflowNodeMutation } from '@unifyapps/app-builder-sdk/hooks/workflow'

const CREATE = { id: 'e_...', context: { appName: '...', resourceName: '...' }, storedInputs: {/* … */} }

export function useCreateTicket() {
  const mutation = useExecuteWorkflowNodeMutation()
  return (ticket: NewTicket) =>
    mutation.mutateAsync({
      id: CREATE.id,
      context: CREATE.context,
      inputs: { ...CREATE.storedInputs, object_type: TICKET, rawPayload: ticket },
    })
}
```

`rawPayload` is the whole record as a plain object. On **update** send the FULL
record plus `recordId`; on **delete** send `entityId` only.

After any write, invalidate or refetch the read that shows it (TanStack Query —
`useQueryClient()` or the mutation's `onSuccess`), or the UI keeps the stale list.

## Always render loading / empty / error

Every read can fail or come back empty. All three states, every screen.

## Authentication & login pages — see the `authentication` skill

Authentication (login pages, making an app public) is **separate from object CRUD** and
now lives in its own skill. It is INDEPENDENT of persistence: a `backend` app may be
public and a `local` app may require login. When the plan's AUTH decision needs a login
page — or you want the public path — load the **`authentication`** skill
(`invoke_skill(name="authentication")`): it covers the `@unifyapps/app-builder-sdk/hooks/auth`
identity-provider / sign-in flow, the engine-owned `VITE_APPLICATION_ID` env var, and how
public-vs-private is the interface's `security.type`. Don't build auth from this skill.

## Rules

- **Never the entity API from app code:** no `/api/entity`, no `/api/aggregation`,
  and none of `useSearchEntities` / `useFindEntityById` / `useCreateEntity` /
  `useUpdateEntity` / `useDeleteEntity`. The running app uses the four bindings.
- **Import path:** every runtime data hook is
  `from '@unifyapps/app-builder-sdk/hooks/workflow'` — same path in every file.
- **Only the declared inputs are overridable** — anything else is dropped silently,
  with a 200 and no error.
- **Authentication is a separate skill:** login pages and making an app public live in
  the `authentication` skill, not here — load it when the plan's AUTH decision calls
  for a login page or the public path.
- **Use the exact `entityType` name** that `create_object` returned — the app and
  the seeded data must agree on it.
- **Real queries only:** always `sortBy` + `page`, and a `triggerInputCondition`
  for any subset (child-by-parent-id, status tabs, search). Fetch-all-then-
  `.filter()` in JS is a bug.
- **Query field paths:** filter/sort by the record id with `field: 'id'`; every
  schema field is `field: 'properties.<key>'`. A bare schema-field name silently
  matches nothing.
- After a create/update/delete, invalidate or refetch the relevant read
  so the UI reflects the change (TanStack Query — use the
  QueryClient from `useQueryClient()` or the mutation's `onSuccess`).
- Always render **loading, empty, and error** states around these hooks — network
  reads can fail or return nothing.
- The exact request/response field names are typed: let the imported types and your
  editor's TypeScript guide the `query` and `data` shapes. Keep `properties` keys
  identical to the object's schema field names.
- Auth is the browser session (cookie) — no tokens to pass in app code.
