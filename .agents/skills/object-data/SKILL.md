---
name: object-data
description: How a generated app reads and writes its backend records at RUN TIME — the five object-agnostic dataSource bindings (fetch many / fetch one / create / update / delete), the exact filter structure, pagination, and the response envelope. BACKEND APPS ONLY — load it before writing any data-access code when the plan says PERSISTENCE: backend, or when adding a backend to an app that was UI-only. A local/UI-only app has no bindings and must never provision them. The app must never call the platform entity API; those are build-time tools. Provisioning the objects themselves (create_object / create_records) is covered by `backend-integration`.
version: 2
---

# Object data at run time — the five bindings

**Only for an app that persists to the BACKEND.** If the plan says `PERSISTENCE: local`
— a UI-only app — none of this applies: keep using the local store, and do NOT call
`provision_data_sources`. Provisioning mints five platform entities; doing it for an app
that never reads them leaves five orphans nobody can attribute. The moment a UI-only app
gains a backend, provision then and come back here.

Everything below is **verified against a live environment**, including the failures.
Where a shape is wrong in a way that still parses, the backend returns **200 and
ignores it** — there is no error to read, so these shapes are not negotiable.

The app never calls the platform entity API (`/api/entity`, `/api/aggregation`, or the
`hooks/object` hooks). Those are the agent's build-time tools, authorized as the person
running the build; a deployed app calling them is unauthorized.

## The tool — `provision_data_sources`

One call, no arguments. It:

1. mints the five `e_data_source` entities for THIS app, anchored to the app's own
   global page (so they still resolve once the app is deployed);
2. writes them into **`src/data/bindings.ts`** — ids, `context`, the full
   `storedInputs` and the `overridable` list, plus the helpers below;
3. returns the same thing in its result, so you can report what happened.

**When to call it**

- ONCE per app, on the FIRST backend build, before you write any data-access code.
- Again only when an app that was UI-only gains a backend — that is a first backend
  build too.

**When NOT to call it**

- `PERSISTENCE: local` / a UI-only app. Ever.
- A second time on an app that already has bindings: the five are object-agnostic and
  already cover every object. Adding an object needs `create_object` + an `ENTITY`
  entry, NOT another binding.
- To "fix" a failing call. A 500 here is almost never a missing binding — read
  "Two rules" below first, then the filter section.

If it reports errors, relay them and do NOT write the calling code: an invented or
copied id builds green and fails every request at run time.

## The bindings

`provision_data_sources` mints five and writes them into **`src/data/bindings.ts`** with
this app's real ids. You never write that file and never type an id into it.

| export | action | overridable inputs |
| --- | --- | --- |
| `FETCH` | fetch records (MULTIPLE) | `object_type`, `triggerInputCondition`, `page`, `sortBy` |
| `FETCH_ONE` | fetch records (SINGLE) | `object_type`, `triggerInputCondition` |
| `CREATE` | create record | `object_type`, `rawPayload` |
| `UPDATE` | update record by id | `object_type`, `recordId`, `rawPayload` |
| `DELETE` | delete record by id | `object_type`, `entityId` |

They are **object-agnostic** — the object is chosen per call via `object_type` — so five
cover every object the app has. Never ask for more.

`FETCH` and `FETCH_ONE` are the same action in two modes. They must be separate bindings:
`numberOfRecordsToFetch` is a stored literal and cannot be templated, because the node
gates `page`/`includeTotalCount` on `MULTIPLE`.

## Two rules that decide whether the call works at all

**1. Send the WHOLE stored input set.** Spread `storedInputs` and override on top:

```ts
inputs: { ...FETCH.storedInputs, object_type, triggerInputCondition, page, sortBy }
```

A subset is refused with `forbidden datasource : invalid input` — **even a subset made
only of overridable fields**. Sending just `object_type` fails.

**2. Only the `overridable` fields may hold a different value.** Change anything else —
even `page.limit` on a binding where `page` is not overridable — and you get the same
error. `{{ }}` decides what may *change*, not what may be *omitted*.

Every call also sends `context: { appName, resourceName }`, which is in the binding.
Omit it and it is `forbidden datasource` again.

## The filter — `triggerInputCondition`

**This is NOT the entity API's `{op, field, values}`.** That shape is accepted with a
**200 and silently ignored**: it returned all 32 records instead of the 8 that matched.

```ts
{
  operator: 'AND',            // or 'OR'
  filters: [
    { property: 'properties.status', filter: { operator: 'EQUAL', value: 'open' } },
  ],
}
```

- **`{}` means no filter** — but still send the key.
- **`value` is singular.** A `values` array errors the workflow (500). The exception is
  `IN`, whose `value` IS an array.
- **Property paths:** the record id is `id`; every schema field is `properties.<key>`.
  A bare `status` is accepted and matches nothing.

Verified operators, on 32 tickets of which 8 are `open` and 4 `closed`:

| filter | result |
| --- | --- |
| `id` `EQUAL` `<id>` | 1 |
| `properties.status` `EQUAL` `'open'` | 8 |
| `properties.status` `NOT_EQUAL` `'open'` | 24 |
| `properties.status` `IN` `['open','closed']` | 12 |
| `properties.status` `CONTAINS` `'ope'` | 8 |
| `operator: 'OR'` over two `EQUAL` leaves | 12 |

Use `andFilter([...])` from `bindings.ts` — it returns `{}` for an empty list, which is
exactly what "no filter" needs.

## Reads go through `useData` — this is what fills the Data panel

A read is declared with `useData(id, 'storage', config)` from `@/lib/data`. It executes
the FETCH binding for you: whole `storedInputs`, filter, sort and paging all handled.

```ts
const { data: tickets, loading, error, total, hasMore } =
  useData<Ticket[]>('tickets', 'storage', {
    object: ENTITY.ticket,
    where: status
      ? [{ property: 'properties.status', filter: { operator: 'EQUAL', value: status } }]
      : [],
    sort: [{ field: 'properties.createdAt', order: 'DESC' }],
    limit: 50,
  })
```

`data` is the **records array itself** — `useData` has already unpacked the envelope.
It is `undefined` while loading and on error; `total`/`hasMore` come back beside it.
There is nothing left to extract (see "The response envelope").

**Calling `useExecuteWorkflowNode` yourself works at run time and is INVISIBLE to the
Data panel** — the panel is built by extracting `useData(...)` calls from source, so a
read that bypasses it leaves the user's Data tab saying "No data flow yet" on an app
that is fully stitched. The first argument is that binding's stable id in the panel:
short, meaningful, stable across redesigns.

Writes have no `useData` equivalent — use the mutation hook with the CREATE / UPDATE /
DELETE bindings (see "Writing").

## The raw call — filters, pagination, and what useData does for you

```ts
inputs: {
  ...FETCH.storedInputs,
  object_type: ENTITY.ticket,
  triggerInputCondition: andFilter(status
    ? [{ property: 'properties.status', filter: { operator: 'EQUAL', value: status } }]
    : []),
  sortBy: [{ field: 'properties.createdAt', order: 'DESC' }],   // 'ASC' | 'DESC'
  page: pageInput(50, 0),      // { paginateBy: 'OFFSET', limit, offset }
}
```

Never fetch everything and `.filter()` in JS — put the condition in the filter and
parameterize the wrapper (`useComments(ticketId)` filters on the parent id).

## Fetching one

`FETCH_ONE` takes a filter, not an id argument — so it reads by id **or** by any field:

```ts
inputs: { ...FETCH_ONE.storedInputs, object_type: ENTITY.ticket,
  triggerInputCondition: andFilter([{ property: 'id', filter: { operator: 'EQUAL', value: id } }]) }
```

```ts
// …or by a business key
andFilter([{ property: 'properties.slug', filter: { operator: 'EQUAL', value: slug } }])
```

## The response envelope — and the ONE place you unpack it

```
{ lookupReferences, response: { cursor, total, objects, hasMore }, id }
```

Records are in `response.objects`; each record's fields are under `record.properties`,
alongside `id`, `createdTime`, `modifiedTime`. The helpers unpack it:

- `extractPage<T>(data)` → `{ records, total, hasMore, cursor }`
- `extractRecords<T>(data)` → just the rows
- `extractRecord<T>(data)` → one record (SINGLE fetch, or the first row)

**They take the RAW envelope — the `data` of a `useExecuteWorkflowNode` /
`useExecuteWorkflowNodeMutation` call you made yourself** (`FETCH_ONE`, and every
write). `useData` already ran them for you.

**NEVER re-extract a `useData` result.** This is the single most common way a
backend-stitched app crashes at run time, and it builds green:

```ts
// WRONG — `data` is already Ticket[]. extractPage looks for `data.response.objects`,
// finds none, and THROWS `unexpected fetch response: no response.objects`. Nothing in
// a wrapper catches it, so the first successful fetch blanks the page.
function useTickets() {
  const { data } = useData<Ticket[]>('tickets', 'storage', { object: ENTITY.ticket })
  return extractRecords<Ticket>(data)          // ← double unpack
}

// RIGHT — take it as it comes, and pass the states through.
function useTickets() {
  const { data, loading, error } = useData<Ticket[]>('tickets', 'storage', {
    object: ENTITY.ticket,
  })
  return { tickets: data ?? [], loading, error }
}
```

The tell is a helper named `records()` / `rows()` / `unwrap()` sitting on top of
`useData` in `src/data/`. If a wrapper's input came from `useData`, delete the
extraction — do not guard it with `try`/`catch`, and do not swap the array for `[]`.

The helpers **throw** on an envelope they do not recognise rather than returning `[]`.
An empty array would render "no records" for a response whose shape changed — the exact
silent failure this data layer exists to avoid. (They now pass an already-extracted
array straight through — but only in `bindings.ts` files written after that landed, so
an app provisioned earlier still crashes. Write the call site as though they did not,
and if you are fixing that crash in an existing app, fix the CALL SITE.)

## Writing

```ts
// create — rawPayload is the whole record as a plain object
inputs: { ...CREATE.storedInputs, object_type: ENTITY.ticket, rawPayload: ticket }

// update — FULL record, plus the id
inputs: { ...UPDATE.storedInputs, object_type: ENTITY.ticket, recordId: id, rawPayload: next }

// delete
inputs: { ...DELETE.storedInputs, object_type: ENTITY.ticket, entityId: id }
```

Keep `rawPayload` keys identical to the object's schema field names.

After any write, invalidate or refetch the read that shows it (TanStack Query —
`useQueryClient()` or the mutation's `onSuccess`), or the list stays stale.

## Where the code lives

`src/data/` only. `bindings.ts` is generated; you write one wrapper per object beside it
(`useTickets`, `useCreateTicket`, …) and components import from `@/data`. Never call
`useExecuteWorkflowNode` / `useExecuteWorkflowNodeMutation` inside a component or page.

Import both hooks from `@unifyapps/app-builder-sdk/hooks/workflow`. Never the bare
`executeWorkflowNode` function — it sends no `x-ua-app` header and the backend rejects
it in preview and deployed alike.

Pick by what the call IS: `useExecuteWorkflowNode` is a query (auto-runs, caches,
refetches) — reads only. `useExecuteWorkflowNodeMutation` fires when called — every
write. A query behind a button fires as soon as its inputs are non-empty and caches the
result, so the second press does nothing.

## Rules

- Never the entity API from app code, and never a hand-written dataSource id.
- Send the whole `storedInputs`; override only `overridable` fields.
- The filter is `{operator, filters:[{property, filter:{operator, value}}]}` — a
  wrong-but-parseable filter returns everything, silently.
- `properties.<key>` for schema fields, bare `id` for the record id.
- Always send `page` on a MULTIPLE fetch; render loading, empty and error states.
- `useData`'s `data` is ALREADY the records array — `extractPage`/`extractRecords`/
  `extractRecord` are for raw `useExecuteWorkflowNode*` results only. Unpacking a
  `useData` result a second time throws `no response.objects` on the first row that
  arrives.
- `object_type` is the entityType `create_object` returned — read it from `ENTITY`.
