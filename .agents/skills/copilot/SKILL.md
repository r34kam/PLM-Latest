---
name: copilot
description: Build a copilot / AI assistant / chatbot into the app — a REAL UnifyApps AI agent via the SDK copilot parts, or a hardcoded mock for a UI-only app. Load whenever the user asks for any of those.
version: 6
---

# Copilot — an AI chat inside the app

Load this whenever the user asks for a **copilot, an AI assistant, a chat, a chatbot, or
"let me ask questions about this data"**. There are two completely different builds behind
that one word, and picking the wrong one wastes the whole turn.

## Which copilot is this? Decide FIRST

One question decides it: **is there a real UnifyApps AI agent to talk to?**

| | build | when |
|---|---|---|
| **Path A** | the real copilot — SDK parts wired to an AI agent | the user has an AI agent (name or id — `find_ai_agent` resolves it) |
| **Path B** | your own copilot — hardcoded replies, no SDK | UI-only / demo / mock-data apps, or no agent id |

## Getting the agent — find it, confirm it, THEN wire it

The user will usually name their agent ("wire it to my Support Copilot"), not paste an id.
`<CopilotProvider>` needs the **id**, and the two are not interchangeable — so resolve the
name first, exactly as you would an automation.

(The agents live in the `ai_agent` entity type. The SDK's own prop docs call the id an
`e_ai_agent` value; no such entity type exists, so do not go looking for one.)

**Resolve it with `find_ai_agent`** — the copilot's equivalent of `find_automation`. Pass
`query`: the agent name (partial is fine) **or** an id. Either resolves.

```
find_ai_agent(query="Support Copilot")
  → {matches: [{id, name, description}], count, matchedBy: "name" | "id"}
```

Then run it exactly like the automation flow:

1. **count > 1** → **do NOT choose.** Show the user each `id` + `name` + `description` and
   ask WHICH id they mean. Several agents can share a word in their name.
2. **count 1** → **confirm before wiring**, the way `confirm_automation_mapping` makes the
   user approve before code is written. One line: "Wiring the copilot to **Tensor Builder**
   (`tensor_builder`) on `/copilot` — correct?" A wrong id is invisible until runtime.
3. **count 0** → tell the user, and ask them to check the name or paste the id from the
   agent's page in UnifyApps. **Never invent one** — a made-up id renders a chat that waits
   forever on a lookup that never resolves: a blank box, no error, nothing in the console.
4. **Never leave it empty to "fill in later".** `<Copilot agentId="">` renders the
   MissingAgentId card, which is a dead screen the user has to come back and fix.

Ids are slugs (`text_to_ui_tensor`, `tensor_builder`), not the `aiAgent_xxx` shape the SDK's
own prop docs suggest — so a name and an id are easy to confuse. Pass what the tool returned,
never what the user typed.

If the user wants a real copilot and has no id to hand: say exactly what you need, then
**build Path B in the meantime** so they have something on screen. Swapping B for A later is
one file.

---

# Path A — a real UnifyApps AI agent

## 1. The component already exists — edit it, don't rewrite it

`src/components/copilot.tsx` ships with the template, already assembled and commented. It is
**unreferenced on purpose**: no route imports it, so an app that never asks for a copilot
bundles none of it.

- **Do** edit that file — layout, chrome, which parts appear. It is ordinary app code.
- **Do NOT** import the SDK's prebuilt `<Copilot />` from `@unifyapps/app-builder-sdk/copilot`.
  It is compiled into the bundle: you cannot restyle it, rearrange it, or put your own header
  on it. The parts exist precisely so you don't have to.

## 2. Add the route — LAZILY

```tsx
const CopilotPage = lazy(() => import('@/pages/CopilotPage'))
// ...
<Route element={<Suspense fallback={<Skeleton className="h-full w-full" />}><CopilotPage /></Suspense>} path="/copilot" />
```

The copilot entry bundles the no-code runtime and every block a reply can render —
**~2.3 MB gzipped**. A static import drags all of it into the entry chunk, so every page in
the app pays for a screen most users never open. `lazy()` + `Suspense` is not a nicety here.

## 3. Four rules from the runtime — not negotiable

1. **Everything inside `<CopilotProvider>`.** Every part and both hooks reach the chat by id
   through the store the provider creates, and **throw** outside it.
2. **One `<CopilotChat>` per provider.** Two copilots on one screen = two providers with
   different `instanceId`.
3. **Import `@unifyapps/app-builder-sdk/copilot.css` once**, where the copilot is composed.
   The copilot has **no styles without it**: ~700 KB carrying the design tokens, all 18
   design-system component stylesheets and a scoped base layer. Omit it and you get exactly
   the symptom list in **§6(d)** — so check this import FIRST, before concluding the vendored
   SDK is stale. It cannot leak into your app: the tokens and base layer are scoped to the
   copilot's own `.ua-variables` root, the component rules are namespaced by their own class
   names, and Tailwind's preflight is deliberately **not** shipped (it is a global reset, and
   this stylesheet loads inside somebody else's app). It rides in the lazy chunk with the
   rest, so §2 defers this too.
4. **Bounded height, with a `min-h-0` chain.** The chat fills whatever you give it, so the
   parent needs a real height. A flex child defaults to `min-height: auto`, so without
   `min-h-0` the conversation and `CopilotHistory` grow to fit every row and the *page*
   scrolls instead of the list.

## 4. Props — `CopilotProvider` / `CopilotConfigProps`

| prop | type | notes |
|---|---|---|
| `agentId` | `string` | **required** — the id `find_ai_agent` returned (a slug, e.g. `tensor_builder`) |
| `chatId` | `string?` | resume a conversation; omit to start fresh |
| `placeholder` | `string?` | composer placeholder |
| `welcomeText` | `string?` | greeting above an empty conversation. A **literal string** — there is no interface behind the component, so `{{ }}` bindings do not resolve |
| `size` | `'lg' \| 'sm'` | `lg` (default) is full-width and can open the canvas beside the chat; `sm` is a narrow panel with no canvas |
| `variant` | `ChatVariants` | `'AI_AGENT'` (default) or `'LIVE_CHAT'` for a human. It is an enum — import `ChatVariants` rather than typing the string |
| `filters` | `UIFilter?` | narrows the conversation list |
| `allowAttachments` | `boolean?` | attach-file control in the composer |
| `showMessageActions` | `boolean?` | per-message copy / retry / feedback |
| `appearance` | see §6 | bubble and surface colours |
| `colorScheme` | `'light' \| 'dark' \| 'system'` | which token set it paints with; defaults to `light`. See §6(c) — a dark app that omits this gets a **light** copilot |
| `className` | `string?` | applied to the component root — **size the copilot by sizing this** |
| `instanceId` | `string?` | distinguishes snackbars when more than one is mounted |

## 5. Hooks — drive your own chrome

```tsx
const { isGenerating, chatId } = useCopilotStatus()
const { sendMessage, stopResponse, newChat, goToChat } = useCopilotActions()
```

- `useCopilotStatus()` reads the same store the chat writes, so it stays **in step with the
  stream** rather than lagging a callback. Use `isGenerating` to swap send for stop.
- `useCopilotActions()` methods resolve through the block ref, so they are **no-ops until
  `<CopilotChat />` has mounted**. Never fire one from an effect on first render.
- **History is composition, not configuration.** There is no `history` prop — place
  `<CopilotHistory />` (and `<CopilotNewChatButton />`, or call `newChat()`) wherever the
  layout wants them. Selecting a conversation switches the chat **on its own**: wire no
  callbacks.

## 6. Theming it — two surfaces, two mechanisms

This is where most copilot work actually goes. Be clear which half you are styling.

**(a) Your chrome — header, drawer, buttons, page shell.** Ordinary app code. Theme tokens
from `src/index.css` exactly like every other component: `bg-background`, `border`,
`text-muted-foreground`. No hex, no inline styles.

**(b) The SDK's internals — bubbles, composer, the conversation surface.** Compiled and
scoped. **Your CSS cannot reach them**, and trying is the trap: descendant selectors and
`!important` against a compiled bundle break on the next SDK version. The only supported
knob is `appearance`:

```tsx
<CopilotProvider
  agentId={agentId}
  appearance={{
    // defaults to `bg-inherit` — the copilot picks up whatever it sits on.
    // Set this ONLY when it sits on a surface it should not inherit.
    backgroundColor: 'bg-card',
    // BUBBLE = every message a rounded filled bubble.
    // DEFAULT = agent replies flush to the background, only the user's are tinted.
    messageVariant: 'BUBBLE',
    customStyles: {
      userMessage:  { backgroundColor: 'bg-primary', borderRadius: '...', padding: '...' },
      brandMessage: { backgroundColor: 'bg-muted',   borderColor: '...' },
    },
  }}
>
```

`customStyles.userMessage` / `.brandMessage` carry `backgroundColor`, `borderColor`,
`borderRadius`, `padding` and their typography.

**(c) Light vs dark — `colorScheme`.** The copilot does **not** read your app's theme. Left
alone it renders **light**, so a dark app must say so:

```tsx
<CopilotProvider agentId={agentId} colorScheme="dark" />
<CopilotProvider agentId={agentId} colorScheme={theme} />    // bind to your theme state
<CopilotProvider agentId={agentId} colorScheme="system" />   // follows prefers-color-scheme, live
```

One prop, because there are two theme layers underneath (the design-system token class and
the Joy theme) and they must move together — setting one alone gives dark tokens under light
surfaces, worse than either scheme on its own. It is scoped to the copilot's own root, so a
dark copilot sits happily inside a light app and vice versa; it will never flip your page.

Note `appearance` values are design-system tokens, so they resolve **against whichever scheme
is active** — a `bg-muted` bubble follows light/dark on its own. Do not branch your
`customStyles` on the theme; pass `colorScheme` and let the tokens do it.

**Your app's `.dark` class means nothing to it.** The copilot reads `colorScheme` and only
`colorScheme`. So an app with a perfectly working dark mode still renders a **light** copilot
until you thread your theme state in — this is the single most likely way to end up with a
light panel glowing inside a dark app.

**Prefer your own state over `'system'` whenever the app has a theme toggle.** `'system'`
follows the OS, so it disagrees with the app the moment a user overrides the OS in-app: dark
page, light copilot. `'system'` is right only for an app that has no toggle of its own.
`CopilotColorScheme` is exported from the same entry if you want to type the state you bind.

**(d) If the copilot looks unstyled — check the CSS import, THEN suspect the vendor.**

A missing `@unifyapps/app-builder-sdk/copilot.css` (§3 rule 3) produces **exactly** the same
symptoms as a stale vendored SDK, and it is the far likelier cause because it is a line you
can forget. Confirm the import exists and runs once where the copilot is composed. Only when
it is definitely there does the list below mean the vendored SDK is stale.

**A stale vendored SDK is not something to patch in app code.**

The SDK's stylesheet ships everything the copilot needs: the design tokens, all 18
design-system component stylesheets, and a base layer scoped to the copilot's root. When it
is current, the copilot is styled. When it is not, you get a specific and recognisable set
of symptoms, all at once:

- send button square instead of circular, buttons rendered as plain rectangles
- thin black hairline borders instead of light grey
- icons at full-bleed size rather than 16px
- message bubbles with no padding
- an unstyled snackbar / feedback modal

That is the app's own Tailwind preflight winning against a bundle that is missing the rules
meant to beat it (v4 zeroes form-control radius; nothing of the SDK's is present to override
it). It is **not** something to fix in app code. Writing CSS overrides, `!important`, or a
local radius to "correct" it produces something that breaks on the next SDK version and
hides a one-line infrastructure fix.

Say the vendored SDK looks stale and needs re-vendoring. You cannot do it from inside the
generated app.

### `BUBBLE` without bubble colours is a bug — always pass both

**If you set `messageVariant: 'BUBBLE'`, you MUST set `customStyles.userMessage` AND
`customStyles.brandMessage` with an explicit `backgroundColor`.** No exceptions.

`DEFAULT` leaves agent replies flush against the surface, so only the user's tint carries
any weight. `BUBBLE` makes the **fill load-bearing on both sides** — it is now the thing
drawing every message. Leave either side unset and that fill falls back to the block's own
default, which is not derived from your app's tokens: you get a copilot with a foreign
palette sitting inside a themed app, and it is the first thing anyone notices.

Pick the pair the way you would any filled surface — a background token with its matching
foreground, so the text stays readable in **both** light and `.dark`:

```tsx
messageVariant: 'BUBBLE',
customStyles: {
  userMessage:  { backgroundColor: 'bg-primary', borderRadius: 'var(--radius)' },
  brandMessage: { backgroundColor: 'bg-muted',   borderRadius: 'var(--radius)' },
},
```

`bg-primary` + `bg-muted` is the safe default pair in this template: the user reads as the
accent, the agent as a quiet surface. If the app's primary is very dark or very saturated,
check the reply text against it rather than assuming — and if you cannot get contrast, use
`DEFAULT` instead of shipping an unreadable bubble.

**Match the app, don't invent a look:** reuse the app's own radius and spacing scale, let
`backgroundColor` inherit when the copilot sits on a themed surface, and check `.dark`.
If `appearance` cannot express something, **leave it** — an unstyled SDK internal is better
than a selector that silently stops matching.

---

# Path B — your own copilot, hardcoded

For UI-only apps: a demo, a prototype, an app whose data is mocked, or a real copilot the
user wants to see before they have an agent.

**Import nothing from `@unifyapps/app-builder-sdk/copilot`.** Shipping 2.3 MB of runtime to
render canned strings is the one unforgivable mistake on this path. Build it from the app's
own primitives — the same Card / Button / Input / ScrollArea everything else uses.

## Make it feel designed, not stubbed

**Pick a persona that fits the app.** "Copilot" is a placeholder name. An ITSM app gets a
triage assistant; a finance dashboard gets an analyst. Name it, give it a one-line purpose
under the title, and write canned replies **in this app's domain vocabulary**, referencing
the same entities the rest of the app shows.

**Suggested prompts on the empty state.** Three or four, as clickable chips. This is what
separates a designed mock from an empty box — and it quietly steers users toward the
questions you actually wrote answers for.

**Stream the reply.** An instant full paragraph reads as fake. Reveal it progressively and
keep it interruptible:

```tsx
type Msg = { id: string; role: 'user' | 'assistant'; content: string }

function useMockCopilot() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [isGenerating, setGenerating] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval>>()

  const stop = useCallback(() => {
    clearInterval(timer.current)
    setGenerating(false)
  }, [])

  // clear the timer on unmount, or it writes into an unmounted tree
  useEffect(() => stop, [stop])

  const send = useCallback((text: string) => {
    const reply = replyFor(text)                      // your canned-response lookup
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'user', content: text }])
    setGenerating(true)

    const id = crypto.randomUUID()
    const words = reply.split(' ')
    let i = 0
    setMessages((m) => [...m, { id, role: 'assistant', content: '' }])
    timer.current = setInterval(() => {
      i += 1
      setMessages((m) => m.map((msg) => (msg.id === id ? { ...msg, content: words.slice(0, i).join(' ') } : msg)))
      if (i >= words.length) stop()
    }, 28)
  }, [stop])

  return { messages, isGenerating, send, stop, reset: () => setMessages([]) }
}
```

**Canned responses:** match on keywords against the app's domain, and always have a
fallback that stays in character and offers what it *can* answer — never "I don't know".

## The details that get skipped

- **Scroll**: pin to the bottom on new content **only if the user is already at the bottom**,
  or you yank the view while they are reading history.
- **States**: empty (persona + suggested prompts), typing (an animated indicator, not a
  spinner), and a plain reply. Match whatever loading/empty treatment the rest of the app uses.
- **Composer**: Enter sends, Shift+Enter is a newline; disable send while empty; swap send for
  **Stop** while generating — you built `stop`, so use it.
- **Accessibility**: the transcript is `role="log"` + `aria-live="polite"`, the input has a
  real label, and the send button has an accessible name when it is icon-only.
- **Never fake a failure.** Don't invent latency spikes or error states a mock cannot
  genuinely have.

---

# Both paths — make it beautiful, and make it look like THIS app

A chat is the most scrutinised surface you will ship: it is read closely, line by line, for
minutes at a time. A copilot that looks bolted on undoes the impression the rest of the app
worked for. The bar is not "functional" — it is that a user seeing it for the first time
cannot tell it came from a library.

Follow the `impeccable` and `frontend-ui-engineering` skills for general craft. What follows
is what is specific to a chat.

**Inherit the app's design language — do not invent one for the copilot.** Its radius is the
app's `--radius`. Its spacing steps are the app's. Its type scale, borders, shadows and
motion are the app's. If the app is dense and flat, a soft floating pastel chat is wrong
however pretty it is in isolation.

**One elevation change, not three.** The commonest failure is a card, inside a panel, inside
a sheet — three nested surfaces with three borders. Pick one container, let the messages sit
directly on it.

**Line length is the readability lever.** Cap the reply column around `max-w-[65ch]`. A
full-width paragraph on a wide screen is the difference between a chat that reads like a
product and one that reads like a log file.

**Rhythm over density.** Generous vertical space *between* turns, tight space *within* a
turn, so the eye groups a message with its own metadata rather than with the next speaker.

**The empty state is the screen users see most.** It gets the persona line and 3–4 suggested
prompts as chips — never a blank panel with a lonely input.

**Quiet chrome.** Header actions are `ghost`/`outline` and small; the composer is the only
emphasised control. A chat with three primary buttons in its header has no focal point.

**Use the app's `Button` for rows and actions — do not hand-roll a hover.** Two failures come
as a pair when you write your own: `hover:bg-accent` without `hover:text-accent-foreground`
leaves the label at its old colour, and `--accent` is a token a generated app is free to theme
to a saturated brand colour. A full-bleed row of that reads as an error state, not a hover.
`variant="ghost"` pairs background and foreground for you (`hover:bg-muted
hover:text-foreground`) and comes out `h-8` like every other control. If you do need custom
markup, inset it (`mx-2` + rounded) so the hover is a chip rather than an edge-to-edge band,
and always set the foreground alongside the background.

**Motion is a whisper.** A short fade or slide on a new message, nothing on every token, and
honour `prefers-reduced-motion`.

**Check `.dark` before you call it done**, and check the streaming state — most copilots look
right empty and fall apart mid-reply, when the typing indicator, the stop button and a
half-rendered message are all on screen at once.

**Placement follows the job.** A copilot that helps with the *current screen* belongs in a
right-hand `Sheet` opened from the header. A copilot that *is* the product gets its own
route and full height (`size: 'lg'`, which can open the canvas beside the chat; `sm` is the
narrow panel with no canvas).

**Don't add a copilot to an app that didn't ask for one.**

## Do NOT

- import the SDK's prebuilt `<Copilot />` — assemble from parts
- invent an `agentId`, or leave `<Copilot agentId="">` rendering silently
- static-import the copilot route (~2.3 MB gzipped into every page)
- style SDK internals with your own CSS — use `appearance`
- "fix" an unstyled copilot with CSS overrides — that is a stale vendored SDK, say so (§6d)
- put a copilot part or hook outside `<CopilotProvider>`
- render two `<CopilotChat>` inside one provider
- pull the SDK copilot into a Path B mock
- set `messageVariant: 'BUBBLE'` without an explicit `backgroundColor` on BOTH
  `customStyles.userMessage` and `customStyles.brandMessage`
- give the copilot its own radius / spacing / type scale instead of the app's
- hardcode hex colours anywhere in either build
