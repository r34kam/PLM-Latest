---
name: automation-integration
description: How to connect a generated app to an existing UnifyApps automation (workflow) — find it, read its input/output schema, confirm an I/O mapping with the user, create the dataSource that authorizes the call, then write the executeWorkflowNode code. MANDATORY whenever the user asks the app to "call / run / trigger / use an automation" (or names one). Uses the find_automation / get_automation_schema / confirm_automation_mapping / create_datasource tools and the @unifyapps/app-builder-sdk/hooks/workflow runtime hooks. Backend objects/records are a SEPARATE concern — see the `backend-integration` skill.
version: 1
---

# Automation integration — call an existing automation from the app

Load and follow this skill whenever the user wants the app to **use an existing
automation** ("run my `send invoice` automation", "call the pricing workflow when
they click Submit"). You do NOT build the automation — it already exists. Your job
is to wire the app to it: pick it, agree the input/output mapping, create the
dataSource that lets the app call it, then write the calling code.

## The flow — four tools, in order

**1. Find it (`find_automation`).** Pass the name (or id) the user gave. You get back
`{ matches: [{ id, name, callable, updatedTime }], count }`.
- **count 1** → use that `id`. If it's `callable: false`, tell the user it can't be run
  from an app and stop (don't create a dataSource for it).
- **count > 1** (several automations share the name) → **do NOT pick one yourself.** Show
  the user each match — **id + name + updatedTime + callable** — and ask **which id** they
  mean. Prefer `callable: true`; a non-callable one can't be connected.
- **count 0** → tell the user; never invent an id.

**2. Read its contract (`get_automation_schema`).** Pass the chosen `automation_ids`.
You get back `[{ id, name, description, inputSchema, outputSchema }]` (both JSON Schema).
`inputSchema` is what the automation needs; `outputSchema` is what it returns.

**3. Agree the mapping (`confirm_automation_mapping`).** Build a **best-guess** mapping
and show it — do NOT skip this and do NOT write code before it:
- **input_mapping** — one entry per `inputSchema` field: `constant` (fixed literal),
  `appData` (an app-state expression), or `arg` (a wrapper argument). Match by name/type;
  fall back to `arg`.
- **output_mapping** — the `outputSchema` fields the app uses (rename via `use_as`).
  Empty for a side-effect automation.
- **records_path** — where the useful data sits in the output (e.g. `["result","items"]`).
- **build_plan** — one sentence telling the user WHERE this lands in the app: the page, the
  trigger (a button or on-load), and the output (a table or cards of which fields). It shows
  in the confirm message so the user sees what they're approving — e.g. "A News page with a
  Refresh button and a card grid of each article's title, source, image and date."

Call it, then **stop and wait**. The confirmed mapping comes back as the next message.

**4. Create the dataSource (`create_datasource`).** AFTER the user confirms, call this with
the chosen `automation_id` and `input_fields` (the `inputSchema` field names the app will
set — the `arg`/`appData` inputs). It returns **`{ dataSourceId, resourceVersion }`**.
**Why this is required:** the platform's callables safety check refuses to run a normal
automation through execute-node unless a real dataSource backs the call — without it you
get HTTP 500 `forbidden datasource: not found`. The tool stores each `input_field` as a
`{{ }}` template so the app can override it at run time. Only THEN write the code.

**If it fails, STOP — do not write the wrapper.** There is no placeholder that is better
than nothing here. A `DATA_SOURCE_ID` you made up (`'__DATA_SOURCE_ID__'`, `'TODO'`, an id
copied from these docs) compiles, builds green and passes review, and then sends that
literal string as the dataSource id on every call the running app makes — so the user sees
a finished-looking app whose every request 500s. Report the tool's error verbatim, say the
automation is not connected, and leave the app without the wrapper. A missing feature is
honest; a wired-looking dead one is not.

## Writing the code — a `src/data/` wrapper

All automation calls live in **`src/data/`**. One wrapper per automation; components import
it, never the SDK hook directly. Import from **`@unifyapps/app-builder-sdk/hooks/workflow`**
(that exact subpath — vendored + aliased, no install).

Pass the `dataSourceId` as `id` and the `resourceVersion` from `create_datasource`. That is
the path native interfaces use and the one the dataSource authorizes.

### Pick the hook by what the automation IS

| The automation… | Use | Why |
| --- | --- | --- |
| runs on a click / submit, or has side effects | `useExecuteWorkflowNodeMutation` | fires only when called; nothing cached or retried |
| should load on mount and only reads | `useExecuteWorkflowNode` | a query: auto-runs, caches by request, refetches |

**Never call the bare `executeWorkflowNode` function.** It carries no `x-ua-app` header and
a relative URL, so the backend rejects it — locally, in preview and deployed. Both hooks
above put the app's identity on the request for you; the bare function cannot.

If in doubt, use the mutation. A query behind a button is the common mistake: it fires as
soon as its inputs are non-empty rather than on the click, and caches the result so pressing
the button again does nothing.

### A mutation (the usual case)

```ts
// src/data/pricing.ts
import { useExecuteWorkflowNodeMutation } from '@unifyapps/app-builder-sdk/hooks/workflow'

const AUTOMATION_ID = 'auto_pricing_id'
// from create_datasource — the dataSource bound to this automation + the callables
// resource version. Both authorize the call; without them the backend rejects it.
const DATA_SOURCE_ID = 'e_...'
const RESOURCE_VERSION = 5482
// this app's own global page — the page create_datasource anchored the dataSource to.
// Derive it, never hardcode: a literal slug names whichever app it was copied from.
const PAGE_SLUG = `global-page-of-${import.meta.env.VITE_APPLICATION_ID}`

export function usePricing() {
  const { mutateAsync, data, isPending, error, reset } = useExecuteWorkflowNodeMutation()

  // `region` is an `arg` input — it overrides the {{region}} template on the dataSource
  const run = (region: string) =>
    mutateAsync({
      data: {
        context: {
          appName: 'callables',
          resourceName: 'callables_call_automation',
          resourceVersion: RESOURCE_VERSION,
        },
        id: DATA_SOURCE_ID,
        inputs: {
          automationId: AUTOMATION_ID,
          version: '-1',
          runtimeConnections: {},
          parameters: {
            // required for callables; carries builder/runtime context
            __internals__: { m: 'BUILDER', s: PAGE_SLUG, c: 'PLATFORM', p: 'browser' },
            region,
            source: 'web', // a `constant` input
          },
          synchronous: true,
        },
        options: {},
      },
    })

  // the automation's output IS `data.response` — see "Reading the output" below
  const items = ((data?.response as { items?: unknown[] } | undefined)?.items ?? []) as Array<{
    list_price: number
  }>
  const rows = items.map((item) => ({ price: item.list_price }))

  // `run` REJECTS on failure — the component must catch it (or use `mutate`) AND render
  // `error`. A silent catch leaves the user staring at a button that looks dead.
  return { run, rows, isPending, error, reset }
}
```

### A read-on-load (only for automations that just fetch)

```ts
import { useExecuteWorkflowNode } from '@unifyapps/app-builder-sdk/hooks/workflow'

export function usePriceList() {
  const { data, isLoading, error, refetch } = useExecuteWorkflowNode({
    context: { appName: 'callables', resourceName: 'callables_call_automation', resourceVersion: RESOURCE_VERSION },
    id: DATA_SOURCE_ID,
    inputs: { automationId: AUTOMATION_ID, version: '-1', runtimeConnections: {}, parameters: { __internals__: {...} }, synchronous: true },
    options: {},
  })
  return { rows: extract(data), isLoading, error, refetch }
}
```

### Reading the output — it is `data.response`, nothing else

Both hooks resolve to the execute-node envelope. This is a REAL response, captured from a
running app:

```json
{
  "executionInstanceId": "6a662833b3a4c712782e39c9",
  "id": "e_6a661b4c17282b2fb934925d",
  "lookupReferences": {},
  "response": { "random_text": "randommmmmmm" }
}
```

So the automation's output is **`data.response`**, and its shape is exactly the
`outputSchema` that `get_automation_schema` returned. There is **no `body` key** — the
generated type says `response?: unknown` and nothing else. Read it directly:

```ts
const { random_text } = (data?.response ?? {}) as { random_text?: string }
```

**Do not write a deep search for your field.** Walking the object tree looking for a key by
name (`findKey(data, 'random_text')`, "try response.body then output then result") is a sign
the path is wrong, and it hides the real problem: it will silently pick up a same-named field
from somewhere else in the envelope, and it keeps working by luck rather than contract. You
already know the shape — you fetched it with `get_automation_schema`. Use it.

If a field is genuinely missing at `data.response`, the automation didn't return it. Say so
and check the automation, rather than searching for it elsewhere.

### Never fetch inside `useEffect`

`project-guidelines.md` says data comes through hooks, never a fetch inside `useEffect` —
and that applies here with no exception. An automation that should run on page load is a
**query**: use `useExecuteWorkflowNode`, which runs on mount by design.

Reaching for `useEffect` + the mutation means you picked the wrong hook. There is no
"external-system boundary" carve-out for automations; the query hook IS the sanctioned
on-load path.

Do **not** pass a `meta` of your own to either hook. The app's identity already rides in the
default meta, and supplying your own on a query REPLACES it (React Query shallow-merges
default options), which drops the `x-ua-app` header and fails the call.

## Building the `parameters` from the mapping

- `constant` → hard-code the value in `parameters`.
- `appData` → reference the confirmed app expression.
- `arg` → a wrapper-function argument the component passes; it overrides the matching
  `{{ }}` template that `create_datasource` stored on the dataSource.

Keep `automationId`, `id` (dataSourceId), and `resourceVersion` exactly as returned — they
are the invocation contract. Always include `parameters.__internals__` for callables.

## Never use `useTriggerWorkflow`

`useTriggerWorkflow` (`/api/workflow/trigger`) is **deprecated** and bypasses the callables
governance layer — **do NOT use it, ever.** Every automation call goes through
`create_datasource` + `executeWorkflowNode` (above). If `create_datasource` fails, surface the
error and stop — do not fall back to trigger.

## Caveats (real, do not skip)

- **Create the dataSource once per automation** and reuse its id — don't mint a new one per
  render. The `create_datasource` step is mandatory for the execute-node path.
- **Result availability depends on the automation.** A synchronous automation (with a
  response/return node) returns its output at `data.response`; one without returns nothing
  useful — treat it as side-effect only.
- **Never hardcode secrets or tenant ids** in the wrapper — the session cookie authenticates
  the call and the SDK's default meta scopes it to this app.
- **Never hand-add the `x-ua-app` header.** The hooks put it there from the app's build-time
  id; a hand-written one goes stale the moment the app id changes.
- **Show failures.** Render `error` in the component. A failed automation call with no visible
  error is indistinguishable from a dead button.
