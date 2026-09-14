import { useEffect, useRef, useState } from 'react'
import { Menu, PanelLeft, Square, SquarePen, TriangleAlert } from 'lucide-react'
import {
  CopilotChat,
  CopilotHistory,
  CopilotProvider,
  useCopilotActions,
  useCopilotStatus,
} from '@unifyapps/app-builder-sdk/copilot'
import '@unifyapps/app-builder-sdk/copilot.css'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useIsDesktop } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'

// The UnifyApps copilot, assembled here rather than imported whole.
//
// The SDK ships the copilot as parts — a provider, the chat, the conversation list, and
// two hooks — with no opinion about layout. That is on purpose: the SDK is a compiled
// bundle, so anything baked into it could never be restyled or rearranged from this app.
// Everything below is ordinary app code. Rearrange it, restyle it, delete what you don't
// need.
//
// Two rules come from the runtime and are not negotiable:
//   1. Every copilot piece and hook must be inside <CopilotProvider>. They reach the chat
//      by id through the store the provider creates, and throw outside it.
//   2. One <CopilotChat> per provider. For two copilots on one screen, use two providers
//      with different `instanceId` values.
//
// THIS FILE OWNS ONLY THE CHROME — the conversation list and the new-chat control. The
// conversation itself (the centred avatar and greeting, the composer with its attach and
// send controls, the suggested prompts) is rendered by <CopilotChat>, and is styled
// through `appearance` on the provider, never from here.
//
// Two shapes, because a drawer and a sidebar are not the same product:
//   * DESKTOP — history is an inline sidebar that pushes the chat, so you can read a
//     conversation while scanning the list. Collapsed by default; the controls then float
//     over the top-left of the chat and the greeting owns the screen.
//   * MOBILE  — history is an overlay drawer off a hamburger, and a real title bar says
//     which screen you are on. There is no room to push anything.

type CopilotProps = {
  /** the AI agent to talk to (`e_ai_agent` id) */
  agentId: string
  /** the app's label for this screen, shown in the mobile title bar. The chat renders the
   * agent's own name in its greeting — this is not that. */
  title?: string
  /** Writing direction for the copilot subtree. `index.html` already carries `dir` on
   * `<html>` and this inherits it — set this only to override for a single screen.
   *
   * It is load-bearing, not cosmetic: the design system's `ltr:` / `rtl:` rules compile to
   * `:where([dir="ltr"], …)`, so with no `dir` anywhere in the document they silently do
   * nothing — message avatars stop being pulled out of the text column and land on top of
   * the message. */
  dir?: 'ltr' | 'rtl'
  className?: string
  /** Reports the chat's generation state and current conversation id to the page above.
   *
   * `useCopilotStatus()` only works inside `<CopilotProvider>`, and a page that owns a
   * split layout has to know about the conversation before the copilot mounts. Rather than
   * forcing every such page inside the provider, the copilot passes the two values it
   * already has outwards. See `StatusBridge`. */
  onStatusChange?: (status: { isGenerating: boolean; chatId?: string }) => void
}

/** Publishes `useCopilotStatus()` to a callback owned by the page.
 *
 * Renders nothing — it exists purely to be a component INSIDE the provider, because that is
 * the only place the hook can legally be called. The effect fires on every change of either
 * value, so a page can treat it as the copilot's status feed. */
function StatusBridge({
  onStatusChange,
}: {
  onStatusChange: (status: { isGenerating: boolean; chatId?: string }) => void
}) {
  const { isGenerating, chatId } = useCopilotStatus()

  useEffect(() => {
    onStatusChange({ isGenerating, chatId })
  }, [isGenerating, chatId, onStatusChange])

  return null
}

/** Circle with the title's first letter. Tokens only, so it follows the app's palette
 * instead of pinning a colour. */
function TitleAvatar({ title }: { title: string }) {
  return (
    <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium">
      {title.trim().charAt(0).toUpperCase() || 'C'}
    </span>
  )
}

/** Compose normally, stop while a reply streams. `useCopilotStatus` reads the same store
 * the chat writes, so it stays in step with the stream instead of lagging a callback. The
 * composer has its own stop; this one is reachable without scrolling to it. */
function PrimaryAction() {
  const { isGenerating } = useCopilotStatus()
  const { newChat, stopResponse } = useCopilotActions()

  return isGenerating ? (
    <Button aria-label="Stop generating" onClick={stopResponse} size="icon" variant="ghost">
      <Square className="size-4" />
    </Button>
  ) : (
    <Button aria-label="New chat" onClick={newChat} size="icon" variant="ghost">
      <SquarePen className="size-4" />
    </Button>
  )
}

/** The drawer's own "New chat" row. A phone has no room for the floating controls the
 * desktop uses, so the action lives where the user already is — above the list, and it
 * closes the drawer so the fresh conversation is what they land on. */
function NewChatRow({ onDone }: { onDone: () => void }) {
  const { newChat } = useCopilotActions()

  return (
    <>
      {/* The app's own Button, not hand-rolled markup. Two reasons, both learned the
          hard way: `ghost` pairs its hover background WITH a foreground
          (`hover:bg-muted hover:text-foreground`), so the label stays readable
          whatever the theme makes that token; and it is `h-8`, the same height as
          every other control, instead of a slab.
          `bg-accent` is the wrong token for a surface this size — a generated app is
          free to theme `--accent` to a saturated brand colour, and a full-bleed row
          of it reads as an error state. */}
      <div className="px-2 pb-1">
        <Button
          className="w-full justify-start"
          onClick={() => {
            newChat()
            onDone()
          }}
          variant="ghost"
        >
          <SquarePen className="size-4" />
          New chat
        </Button>
      </div>
      <div className="mx-2 border-b" />
    </>
  )
}

/** Sidebar history panel — lives BESIDE the chat, never replacing it.
 *  When a conversation is selected (chatId changes) the panel auto-closes so the
 *  user lands immediately in the conversation they picked. */
function HistorySidebar({ onCollapse }: { onCollapse: () => void }) {
  const { chatId } = useCopilotStatus()
  const prevChatIdRef = useRef(chatId)

  // Auto-close history when the user selects a conversation (chatId switches)
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId
      onCollapse()
    }
  })

  return (
    <div
      className="flex flex-col border-r bg-card"
      style={{ width: 260, minWidth: 260 }}
      data-test-id="copilot-history-sidebar"
    >
      <div className="flex items-center justify-between px-2 py-2 border-b">
        <span className="text-sm font-medium text-foreground px-1">Conversations</span>
        <Button aria-label="Close conversations" onClick={onCollapse} size="icon" variant="ghost">
          <PanelLeft className="size-4" />
        </Button>
      </div>
      <div className="px-2 py-1 border-b">
        <NewChatRowSidebar onDone={onCollapse} />
      </div>
      <CopilotHistory className="min-h-0 flex-1" />
    </div>
  )
}

/** Inline "New chat" for the sidebar (no close-drawer semantics needed). */
function NewChatRowSidebar({ onDone }: { onDone: () => void }) {
  const { newChat } = useCopilotActions()
  return (
    <Button
      className="w-full justify-start"
      onClick={() => { newChat(); onDone() }}
      variant="ghost"
      size="sm"
      data-test-id="copilot-new-chat-sidebar"
    >
      <SquarePen className="size-4 mr-2" />
      New chat
    </Button>
  )
}

// Without an agent there is nothing to talk to, and the copilot's own failure mode here is
// unhelpful: it waits on an agent lookup that never resolves and renders an empty box with
// no error. Catching it in the app turns a blank screen into an instruction.
function MissingAgentId() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <Card className="max-w-md">
        <CardHeader>
          <div className="bg-muted mb-2 flex size-9 items-center justify-center rounded-md">
            <TriangleAlert className="text-muted-foreground size-5" />
          </div>
          <CardTitle>Copilot isn't configured</CardTitle>
          <CardDescription>
            This copilot needs the id of the AI agent it should talk to.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          <p>
            Pass an <code className="bg-muted rounded px-1 py-0.5 text-xs">agentId</code> to{' '}
            <code className="bg-muted rounded px-1 py-0.5 text-xs">&lt;Copilot /&gt;</code> — the
            agent's <code className="bg-muted rounded px-1 py-0.5 text-xs">e_ai_agent</code> id,
            which you can copy from the agent's page in UnifyApps.
          </p>
          <p>
            Set it wherever you render{' '}
            <code className="bg-muted rounded px-1 py-0.5 text-xs">&lt;Copilot /&gt;</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export function Copilot({
  agentId,
  title = 'Copilot',
  dir,
  className,
  onStatusChange,
}: CopilotProps) {
  // Which chrome to MOUNT, not merely which to show — `hidden md:flex` would leave the
  // sidebar AND the drawer in the tree, putting two <CopilotHistory> lists inside one
  // provider. See the hook for the general rule.
  const isDesktop = useIsDesktop()
  // Collapsed by default so the greeting owns the first screen; the sidebar is a
  // deliberate move, not the landing state.
  const [historyOpen, setHistoryOpen] = useState(false)

  if (!agentId) return <MissingAgentId />

  return (
    <CopilotProvider
      agentId={agentId}
      className={cn('flex h-full flex-col', className)}
      dir={dir}
      // `lg` (the default) opens the SDK's own canvas beside the chat for file artifacts.
      // For HTML that canvas is permanently blank — it points an `<iframe src>` at the
      // artifact's download URL, which the platform serves as an attachment, so the frame
      // is handed to the download manager and left empty. This app renders artifacts
      // itself (see `features/copilot`), so the SDK canvas would only ever be a blank
      // column beside a working one. `sm` leaves it out.
      size="sm"
    >
      {onStatusChange ? <StatusBridge onStatusChange={onStatusChange} /> : null}
      {!isDesktop ? (
        <header className="relative flex items-center justify-center border-b px-2 py-3">
          <Button
            aria-label="Conversations"
            className="absolute left-2"
            onClick={() => setHistoryOpen(true)}
            size="icon"
            variant="ghost"
          >
            <Menu className="size-5" />
          </Button>
          <div className="flex min-w-0 items-center gap-2 px-12">
            <TitleAvatar title={title} />
            <span className="truncate text-base font-semibold">{title}</span>
          </div>
        </header>
      ) : null}

      <div className="flex min-h-0 flex-1" data-test-id="copilot-body">
        {/* Desktop: history is a sidebar that slides in BESIDE the chat.
            Both panels stay mounted — the SDK keeps its state (chatId, stream) at all times. */}
        {isDesktop && historyOpen ? (
          <HistorySidebar onCollapse={() => setHistoryOpen(false)} />
        ) : null}

        {/* Chat area — always visible, always mounted. */}
        <div
          className="relative flex min-h-0 flex-1 flex-col"
          data-test-id="copilot-chat-area"
        >
          {isDesktop && !historyOpen ? (
            <div className="absolute top-3 left-3 z-10 flex items-center gap-1">
              <Button
                aria-label="Conversations"
                onClick={() => setHistoryOpen(true)}
                size="icon"
                variant="ghost"
                data-test-id="copilot-open-history-btn"
              >
                <PanelLeft className="size-4" />
              </Button>
              <PrimaryAction />
            </div>
          ) : null}

          <div className="min-h-0 flex-1">
            <CopilotChat />
          </div>
        </div>
      </div>

      {!isDesktop ? (
        <Sheet onOpenChange={setHistoryOpen} open={historyOpen}>
          <SheetContent className="flex flex-col gap-0 p-0" side="left">
            <SheetHeader className="px-4 py-3">
              <SheetTitle>Conversations</SheetTitle>
            </SheetHeader>
            <NewChatRow onDone={() => setHistoryOpen(false)} />
            <CopilotHistory className="min-h-0 flex-1" />
          </SheetContent>
        </Sheet>
      ) : null}
    </CopilotProvider>
  )
}
