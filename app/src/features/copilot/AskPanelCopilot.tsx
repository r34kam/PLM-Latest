/**
 * AskPanelCopilot — chrome for the third-pane "Ask AI" overlay ONLY.
 *
 * CopilotChat is ALWAYS mounted (SDK requirement — it owns the store state).
 * History slides in as an absolute overlay OVER the chat area so the chat
 * never unmounts. Selecting a conversation auto-dismisses the overlay.
 *
 * DO NOT import from the Reports page — that uses its own Copilot component.
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
import { ArrowLeft, Clock, SquarePen, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const AGENT_NAME = 'PLM Agent'
const AGENT_SUBTITLE = 'Ask about change orders, items, suppliers and approvals.'

/* ---- shared icon button -------------------------------------------- */

type IconBtnProps = {
  onClick: () => void
  label: string
  children: React.ReactNode
  'data-test-id'?: string
}

function IconBtn({ onClick, label, children, 'data-test-id': testId }: IconBtnProps) {
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
        const el = e.currentTarget as HTMLButtonElement
        el.style.background = '#f0f4f8'
        el.style.color = '#0a2233'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.background = 'transparent'
        el.style.color = '#627d98'
      }}
    >
      {children}
    </button>
  )
}

/* ---- new-chat / stop button (needs provider context) --------------- */

function NewChatBtn({ 'data-test-id': testId }: { 'data-test-id'?: string }) {
  const { isGenerating } = useCopilotStatus()
  const { newChat, stopResponse } = useCopilotActions()

  if (isGenerating) {
    return (
      <IconBtn onClick={stopResponse} label="Stop generating" data-test-id="ask-stop-btn">
        <span style={{ width: 12, height: 12, borderRadius: 2, background: 'currentColor', display: 'block' }} />
      </IconBtn>
    )
  }
  return (
    <IconBtn onClick={newChat} label="New chat" data-test-id={testId ?? 'ask-new-chat-btn'}>
      <SquarePen size={16} strokeWidth={1.8} />
    </IconBtn>
  )
}

/* ---- history overlay (absolute, sits on top of CopilotChat) -------- */

function HistoryOverlay({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { chatId } = useCopilotStatus()
  const prevChatId = useRef(chatId)

  // auto-dismiss when a conversation is selected (chatId changes)
  useEffect(() => {
    if (prevChatId.current !== chatId) {
      prevChatId.current = chatId
      if (visible) onClose()
    }
  })

  return (
    <div
      data-test-id="ask-history-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10,
        // slide in/out vertically
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform .22s cubic-bezier(0.16,1,0.3,1)',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {/* History header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 14px',
          borderBottom: '1px solid #e2e8f0',
          flexShrink: 0,
          gap: 4,
        }}
        data-test-id="ask-history-header"
      >
        <IconBtn onClick={onClose} label="Back to chat" data-test-id="ask-history-back-btn">
          <ArrowLeft size={16} strokeWidth={1.8} />
        </IconBtn>

        <span style={{ flex: 1, fontSize: 16, fontWeight: 700, color: '#0a2233', paddingLeft: 4 }}>
          Conversations
        </span>

        <NewChatBtn data-test-id="ask-history-new-btn" />

        <IconBtn onClick={onClose} label="Close history" data-test-id="ask-history-close-btn">
          <X size={16} strokeWidth={1.8} />
        </IconBtn>
      </header>

      {/* Full-width conversation list */}
      <CopilotHistory className="min-h-0 flex-1" />
    </div>
  )
}



/* ---- main component ------------------------------------------------ */

type Props = {
  agentId: string
  onClose: () => void
  className?: string
}

export function AskPanelCopilot({ agentId, onClose, className }: Props) {
  const [historyVisible, setHistoryVisible] = useState(false)

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
      {/* Chat header — always visible */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          borderBottom: '1px solid #e2e8f0',
          flexShrink: 0,
          zIndex: 1,
          position: 'relative',
          background: '#ffffff',
        }}
        data-test-id="ask-panel-header"
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0a2233', lineHeight: 1.2 }}>
            {AGENT_NAME}
          </div>
          <div style={{ fontSize: 12, color: '#7993a8', marginTop: 2, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {AGENT_SUBTITLE}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <IconBtn
            onClick={() => setHistoryVisible(true)}
            label="Conversation history"
            data-test-id="ask-history-btn"
          >
            <Clock size={16} strokeWidth={1.8} />
          </IconBtn>
          <NewChatBtn />
          <IconBtn onClick={onClose} label="Close" data-test-id="ask-close-btn">
            <X size={16} strokeWidth={1.8} />
          </IconBtn>
        </div>
      </header>

      {/* Body: CopilotChat always mounted + history overlay on top */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }} data-test-id="ask-panel-body">
        {/* Chat — always in the tree */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }} data-test-id="ask-chat-area">
          <CopilotChat />
        </div>

        {/* History overlay — slides up over the chat, never unmounts CopilotChat */}
        <HistoryOverlay
          visible={historyVisible}
          onClose={() => setHistoryVisible(false)}
        />
      </div>
    </CopilotProvider>
  )
}
