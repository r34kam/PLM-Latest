import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Check, LoaderCircle } from 'lucide-react'
import { useUpdatePassword } from '@unifyapps/app-builder-sdk/hooks/auth'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { usePasswordPolicy } from '@/lib/passwordPolicy'

// ── Left decorative panel (identical to Login) ─────────────────────────────────
function HeroPanelSvg() {
  return (
    <svg
      viewBox="0 0 740 800"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.9 }}
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      {[200, 300, 400, 500, 600].map((y) => (
        <line key={y} x1="0" y1={y} x2="740" y2={y} stroke="#1e3a52" strokeWidth="1" strokeDasharray="4 6" />
      ))}
      {[150, 300, 450, 600].map((x) => (
        <line key={x} x1={x} y1="0" x2={x} y2="800" stroke="#1e3a52" strokeWidth="1" strokeDasharray="4 6" />
      ))}
      <path
        id="up-curve"
        d="M -20 600 C 80 590, 160 560, 230 510 C 310 450, 360 400, 440 310 C 510 230, 580 150, 760 40"
        stroke="#4a9fd4"
        strokeWidth="2.5"
        fill="none"
      />
      <circle cx="160" cy="548" r="5" fill="#4a9fd4" />
      <circle cx="232" cy="500" r="5" fill="#4a9fd4" />
      <g>
        <circle r="14" stroke="#4a9fd4" strokeWidth="2" fill="#0d2137">
          <animateMotion dur="5s" repeatCount="indefinite" rotate="none" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.6 1">
            <mpath href="#up-curve" />
          </animateMotion>
        </circle>
        <circle r="6" fill="#4a9fd4">
          <animateMotion dur="5s" repeatCount="indefinite" rotate="none" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.6 1">
            <mpath href="#up-curve" />
          </animateMotion>
        </circle>
      </g>
      <text x="200" y="378" fill="#a0c4e0" fontSize="12" fontFamily="monospace" letterSpacing="1">REV A</text>
      <text x="456" y="258" fill="#ffffff" fontSize="11" fontFamily="monospace" letterSpacing="1">● REV C // CCB APPROVED</text>
      <text x="540" y="190" fill="#a0c4e0" fontSize="11" fontFamily="monospace" letterSpacing="1">PROD SYNC</text>
    </svg>
  )
}

function HeroPanel() {
  return (
    <div
      style={{
        flex: '0 0 49%',
        background: 'linear-gradient(160deg, #0d2137 0%, #0a1929 60%, #061220 100%)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '28px 32px 40px',
        minHeight: '100vh',
      }}
      data-test-id="up-hero-panel"
    >
      <HeroPanelSvg />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#4a9fd4', border: '2px solid #4a9fd4' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #4a9fd4', background: 'transparent' }} />
        </div>
        <span style={{ color: '#ffffff', fontSize: 16, fontWeight: 600, letterSpacing: '0.02em' }}>Topcon PLM</span>
      </div>
      <div style={{ position: 'absolute', top: 28, right: 32, zIndex: 1 }}>
        <span style={{ color: '#4a9fd4', fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.08em' }}>
          SYS: LIV-HQ / TOL: ±0.01MM
        </span>
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <h2 style={{
          color: '#ffffff',
          fontSize: 'clamp(28px, 4vw, 42px)',
          fontWeight: 400,
          lineHeight: 1.2,
          letterSpacing: '-0.01em',
          marginBottom: 16,
          fontFamily: "Georgia, 'Times New Roman', serif",
          textWrap: 'balance',
        }}>
          Nobody notices the bill of materials until the line stops.
        </h2>
        <p style={{ color: '#7aafcf', fontSize: 14, lineHeight: 1.65, maxWidth: 480 }}>
          So Topcon PLM traces every engineering change, CAD revision, and supplier sign-off back to the rule, the spec and the deal that produced it — before anyone has to come and ask.
        </p>
      </div>
    </div>
  )
}

// Update-password route — the destination the SDK auto-redirects to when the backend
// returns an "expired password" (first-login / forced-reset) response. It collects a
// NEW password (twice), enforces the app's password policy client-side, then calls the
// SDK's useUpdatePassword() hook — POST /api/user/update-password. That call sets the new
// password AND invalidates the current session (deleteSessions: true), so on success we
// send the user back to /login to sign in again with the new password.
//
// The rules are NOT written here: they come from the app's own policy, which its owner
// configures on the platform and the API enforces (see @/lib/passwordPolicy). Hardcoding
// them is how the form ends up accepting a password the server then rejects.

function resolveReturnTo(): string | null {
  return new URLSearchParams(window.location.search).get('returnTo')
}

function ErrorAlert({ message }: { message?: string }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="flex w-full items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}


export default function UpdatePassword() {
  const navigate = useNavigate()
  const update = useUpdatePassword()
  const { rules, notes, isLoading: isPolicyLoading } = usePasswordPolicy()

  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [submitted, setSubmitted] = React.useState(false)

  const unmetRules = rules.filter((rule) => !rule.test(password))
  const passwordsMatch = password.length > 0 && password === confirm
  // Until the policy resolves we don't know the real rules — letting a submit through on
  // the fallback set is exactly the "form said OK, server said no" case this avoids.
  const canSubmit = !isPolicyLoading && unmetRules.length === 0 && passwordsMatch

  // Client-side validation message shown only after a submit attempt.
  const validationError = !submitted
    ? undefined
    : unmetRules.length > 0
      ? 'Your password does not meet the requirements below.'
      : !passwordsMatch
        ? 'The two passwords do not match.'
        : undefined

  const serverError = (update.error as { message?: string } | null)?.message

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!canSubmit) return
    update.mutate(
      { password },
      {
        onSuccess: () => {
          // The password change deleted the session — send the user back to /login
          // (preserving any returnTo the SDK stashed) to sign in with the new password.
          const returnTo = resolveReturnTo()
          navigate(`/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`, {
            replace: true,
          })
        },
      },
    )
  }

  return (
    <main style={{ display: 'flex', minHeight: '100vh' }} data-test-id="up-root">
      <HeroPanel />
      <div
        style={{
          flex: '0 0 51%',
          background: '#f4f6f8',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '48px 32px',
        }}
        data-test-id="up-auth-panel"
      >
        <div style={{ width: '100%', maxWidth: 420 }}>
          <h1
            style={{ fontSize: 32, fontWeight: 400, color: '#0a1929', marginBottom: 8, fontFamily: "Georgia, 'Times New Roman', serif", letterSpacing: '-0.02em' }}
            data-test-id="up-heading"
          >
            Set a new password
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 32 }}>
            Choose a new password to continue to your account.
          </p>

          <form style={{ display: 'flex', flexDirection: 'column', gap: 20 }} onSubmit={handleSubmit} data-test-id="up-form">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label htmlFor="new-password">New password</Label>
              <PasswordInput
                id="new-password"
                autoFocus
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-test-id="up-new-password-input"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <PasswordInput
                id="confirm-password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                data-test-id="up-confirm-password-input"
              />
            </div>

            <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, listStyle: 'none', padding: 0, margin: 0 }}>
              {rules.map((rule) => {
                const met = rule.test(password)
                return (
                  <li
                    key={rule.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: met ? '#059669' : '#6b7280' }}
                    data-test-id={`up-rule-${rule.id}`}
                  >
                    <Check style={{ width: 16, height: 16, flexShrink: 0, opacity: met ? 1 : 0.3 }} />
                    {rule.label}
                  </li>
                )
              })}
              <li
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: passwordsMatch ? '#059669' : '#6b7280' }}
                data-test-id="up-rule-match"
              >
                <Check style={{ width: 16, height: 16, flexShrink: 0, opacity: passwordsMatch ? 1 : 0.3 }} />
                Both passwords match
              </li>
            </ul>

            {notes.length > 0 && (
              <p style={{ fontSize: 12, color: '#6b7280' }}>{notes.join(' ')}</p>
            )}

            <ErrorAlert message={validationError ?? serverError} />

            <Button
              type="submit"
              size="lg"
              className="h-11 w-full"
              disabled={update.isPending || isPolicyLoading}
              data-test-id="up-submit-btn"
            >
              {(update.isPending || isPolicyLoading) && (
                <LoaderCircle className="size-4 animate-spin" />
              )}
              Update password
            </Button>
          </form>
        </div>
      </div>
    </main>
  )
}
