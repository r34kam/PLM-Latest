/**
 * AskPanelCopilot — chrome for the third-pane "Ask AI" overlay ONLY.
 *
 * Layout mirrors the reference screenshot:
 *   ┌─ header ─────────────────────────────────────────────┐
 *   │  [avatar]  Agent name          [history] [new] [×]  │
 *   │            Agent subtitle                            │
 *   ├──────────────────────────────────────────────────────┤
 *   │                                                      │
 *   │              <CopilotChat>                           │
 *   │  (SDK renders: large avatar, greeting, prompts,      │
 *   │   conversation bubbles, and the composer at bottom)  │
 *   │                                                      │
 *   └──────────────────────────────────────────────────────┘
 *
 * DO NOT import this from the Reports page — that page has its own
 * separate Copilot component and must remain unchanged.
 */
import React, { useEffect, useRef, useState } from 'react'
import {
  CopilotChat,
  CopilotHistory,
  CopilotProvider,
  useCopilotActions,
  useCopilotStatus,
} from '@unifyapps/app-builder-sdk/copilot'
import '@unifyapps/app-builder-sdk/copilot.css'
import { Clock, PanelLeft, SquarePen, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── agent meta ────────────────────────────────────────────────────── */

const AGENT_NAME = 'PLM Agent'
const AGENT_SUBTITLE = 'Ask about change orders, items, suppliers and approvals.'

/* ── header icon button ─────────────────────────────────────────────── */

function IconBtn({
  onClick,
  label,
  children,
  'data-test-id': testId,
}: {
  onClick: () => void
  label: string
  children: React.ReactNode
  'data-test-id'?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      data-test-id={testId}
      style={{
        display: 'grid',
        placeItems: 'center',
        width: 34,
        height: 34,
        borderRadius: 8,
        border: 'none',
        background: 'transparent',
        color: '#627d98',
        cursor: 'pointer',
        transition: 'background .1s, color .1s',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.background = '#f0f4f8'
        ;(e.currentTarget as HTMLButtonElement).style.color = '#0a2233'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
        ;(e.currentTarget as HTMLButtonElement).style.color = '#627d98'
      }}
    >
      {children}
    </button>
  )
}

/* ── header new-chat + stop control (inside provider) ──────────────── */

function NewChatAction() {
  const { isGenerating } = useCopilotStatus()
  const { newChat, stopResponse } = useCopilotActions()

  return isGenerating ? (
    <IconBtn onClick={stopResponse} label="Stop generating" data-test-id="ask-stop-btn">
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: 2,
          background: 'currentColor',
          display: 'block',
        }}
      />
    </IconBtn>
  ) : (
    <IconBtn onClick={newChat} label="New chat" data-test-id="ask-new-chat-btn">
      <SquarePen size={16} strokeWidth={1.8} />
    </IconBtn>
  )
}

/* ── history sidebar (slides in beside the chat) ───────────────────── */

function HistorySidebar({ onCollapse }: { onCollapse: () => void }) {
  const { chatId } = useCopilotStatus()
  const prevChatId = useRef(chatId)

  // auto-close when the user picks a conversation
  useEffect(() => {
    if (prevChatId.current !== chatId) {
      prevChatId.current = chatId
      onCollapse()
    }
  })

  return (
    <div
      style={{
        width: 240,
        minWidth: 240,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #e2e8f0',
        background: '#fff',
      }}
      data-test-id="ask-history-sidebar"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 12px 10px',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: '#0a2233' }}>Conversations</span>
        <IconBtn onClick={onCollapse} label="Close history" data-test-id="ask-close-history-btn">
          <PanelLeft size={15} strokeWidth={1.8} />
        </IconBtn>
      </div>
      <CopilotHistory className="min-h-0 flex-1" />
    </div>
  )
}

/* ── agent avatar ────────────────────────────────────────────────────── */

function AgentAvatar({ size = 40 }: { size?: number }) {
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#1a3a2a',
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}
    >
      {/* Two dots — generic PLM agent mark */}
      <svg width={size * 0.48} height={size * 0.48} viewBox="0 0 20 20" fill="none">
        <circle cx="7" cy="11" r="4" fill="white" fillOpacity="0.9" />
        <circle cx="14" cy="7" r="2.5" fill="white" fillOpacity="0.6" />
      </svg>
    </div>
  )
}

/* ── main component ─────────────────────────────────────────────────── */

type Props = {
  agentId: string
  onClose: () => void
  className?: string
}

export function AskPanelCopilot({ agentId, onClose, className }: Props) {
  const [historyOpen, setHistoryOpen] = useState(false)

  return (
    <CopilotProvider
      agentId={agentId}
      className={cn('flex flex-col', className)}
      colorScheme="light"
      size="sm"
      appearance={{
        backgroundColor: 'bg-background',
        messageVariant: 'BUBBLE',
        customStyles: {
          userMessage: { backgroundColor: 'bg-primary' },
          brandMessage: { backgroundColor: 'bg-muted' },
        },
      }}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          borderBottom: '1px solid #e2e8f0',
          flexShrink: 0,
        }}
        data-test-id="ask-panel-header"
      >
        <AgentAvatar size={40} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0a2233', lineHeight: 1.2 }}>
            {AGENT_NAME}
          </div>
          <div
            style={{
              fontSize: 12,
              color: '#7993a8',
              marginTop: 2,
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {AGENT_SUBTITLE}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <IconBtn
            onClick={() => setHistoryOpen((v) => !v)}
            label="Conversation history"
            data-test-id="ask-history-btn"
          >
            <Clock size={16} strokeWidth={1.8} />
          </IconBtn>

          <NewChatAction />

          <IconBtn onClick={onClose} label="Close" data-test-id="ask-close-btn">
            <X size={16} strokeWidth={1.8} />
          </IconBtn>
        </div>
      </header>

      {/* ── Body: optional history sidebar + chat ───────────────── */}
      <div
        style={{ display: 'flex', flex: 1, minHeight: 0 }}
        data-test-id="ask-panel-body"
      >
        {historyOpen && (
          <HistorySidebar onCollapse={() => setHistoryOpen(false)} />
        )}

        {/* The SDK renders: empty-state greeting + suggested prompts + conversation + composer */}
        <div
          style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}
          data-test-id="ask-chat-area"
        >
          <CopilotChat />
        </div>
      </div>
    </CopilotProvider>
  )
}
