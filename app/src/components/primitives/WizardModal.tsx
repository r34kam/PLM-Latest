import { Check, X } from 'lucide-react'
import React from 'react'

/**
 * WizardModal — the two-panel creation journey shell.
 *
 * Layout (matches reference screenshot):
 *   ┌─ header (title + X) ──────────────────────────────────────┐
 *   │ left: numbered step list │ right: scrollable form content │
 *   └─ footer (Back  ·  Next / Submit) ────────────────────────┘
 *
 * Usage:
 *   <WizardModal
 *     title="New change order"
 *     steps={[{label:"Basic Details", sub:"Title, type & priority"}, ...]}
 *     currentStep={i}
 *     onStepClick={setI}   // optional — allows clicking completed steps
 *     onClose={onClose}
 *     foot={<>back button · next button</>}
 *   >
 *     {formContent}
 *   </WizardModal>
 */

type SubItem = {
  key: string
  label: string
  status?: 'done' | 'pending' | 'none'
  onClick: () => void
  active: boolean
}

type Step = {
  label: string
  sub?: string
  subItems?: SubItem[]
}

type WizardModalProps = {
  title: string
  steps: Step[]
  currentStep: number
  onStepClick?: (idx: number) => void
  onClose: () => void
  foot?: React.ReactNode
  children: React.ReactNode
  'data-test-id'?: string
}

export function WizardModal({
  title,
  steps,
  currentStep,
  onStepClick,
  onClose,
  foot,
  children,
  'data-test-id': testId,
}: WizardModalProps) {
  return (
    <div
      className="modalbg"
      onClick={onClose}
      data-test-id={testId ?? 'wizard-modal-backdrop'}
    >
      <div
        className="modal-wizard"
        onClick={(e) => e.stopPropagation()}
        data-test-id="wizard-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <div className="modal-wizard-head" data-test-id="wizard-modal-head">
          <h2>{title}</h2>
          <button
            type="button"
            className="btn gh sm"
            onClick={onClose}
            aria-label="Close"
            data-test-id="wizard-modal-close"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────── */}
        <div className="modal-wizard-body" data-test-id="wizard-modal-body">
          {/* Left: step list */}
          <nav className="modal-wizard-steps" aria-label="Steps" data-test-id="wizard-steps">
            {steps.map((step, idx) => {
              const isDone = idx < currentStep
              const isActive = idx === currentStep
              return (
                <React.Fragment key={idx}>
                  <button
                    type="button"
                    className={`modal-wizard-step${isActive ? ' active' : ''}${isDone ? ' done' : ''}`}
                    onClick={() => isDone && onStepClick?.(idx)}
                    aria-current={isActive ? 'step' : undefined}
                    data-test-id={`wizard-step-${idx}`}
                    style={{ cursor: isDone && onStepClick ? 'pointer' : 'default' }}
                  >
                    <span className="mws-num" aria-hidden="true">
                      {isDone ? <Check size={13} strokeWidth={3} /> : idx + 1}
                    </span>
                    <span>
                      <div className="mws-label">{step.label}</div>
                      {step.sub && !isActive && <div className="mws-sub">{step.sub}</div>}
                    </span>
                  </button>

                  {/* Sub-items — shown as indented children when step is active */}
                  {isActive && step.subItems && step.subItems.length > 0 && (
                    <div className="mws-subitems" data-test-id={`wizard-step-${idx}-subitems`}>
                      {step.subItems.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          className={`mws-subitem${item.active ? ' active' : ''}`}
                          onClick={item.onClick}
                          data-test-id={`wizard-subitem-${item.key}`}
                        >
                          <span className="mws-subitem-dot" aria-hidden="true" />
                          <span className="mws-subitem-label">{item.label}</span>
                          {item.status === 'done' && (
                            <span className="mws-subitem-check" aria-label="Complete">
                              <Check size={10} strokeWidth={3} />
                            </span>
                          )}
                          {item.status === 'pending' && (
                            <span className="mws-subitem-pending" aria-label="Incomplete" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </React.Fragment>
              )
            })}
          </nav>

          {/* Right: form content */}
          <div className="modal-wizard-content" data-test-id="wizard-modal-content">
            {children}
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────── */}
        {foot && (
          <div className="modal-wizard-foot" data-test-id="wizard-modal-foot">
            {foot}
          </div>
        )}
      </div>
    </div>
  )
}
