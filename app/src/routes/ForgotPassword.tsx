import * as React from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, LoaderCircle } from 'lucide-react'
import { useSendForgotPasswordEmail } from '@unifyapps/app-builder-sdk/hooks/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Forgot-password route — reached from the "Forgot password?" link on the login page.
// Step 1 ("enter"): collect the USERNAME and call the SDK's useSendForgotPasswordEmail()
//   hook, which emails a reset link. Like the login form, the username field gets NO
//   client-side validation — pass whatever the user types straight through.
// Step 2 ("sent"): confirm the email was sent, offer a resend, and a way back to login.

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
        id="fp-curve"
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
            <mpath href="#fp-curve" />
          </animateMotion>
        </circle>
        <circle r="6" fill="#4a9fd4">
          <animateMotion dur="5s" repeatCount="indefinite" rotate="none" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.6 1">
            <mpath href="#fp-curve" />
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
      data-test-id="fp-hero-panel"
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

export default function ForgotPassword() {
  const send = useSendForgotPasswordEmail()
  const [username, setUsername] = React.useState('')
  const [sent, setSent] = React.useState(false)

  const serverError = (send.error as { message?: string } | null)?.message

  function submit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!username) return
    send.mutate({ username }, { onSuccess: () => setSent(true) })
  }

  const formContent = sent ? (
    <div style={{ width: '100%' }}>
      <h1 style={{ fontSize: 32, fontWeight: 400, color: '#0a1929', marginBottom: 8, fontFamily: "Georgia, 'Times New Roman', serif", letterSpacing: '-0.02em' }}>
        Check your email
      </h1>
      <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 32 }}>
        We've sent reset instructions to your email.
      </p>

      <p style={{ fontSize: 14, color: '#111827', marginBottom: 8 }}>
        Haven't received the email?{' '}
        <button
          type="button"
          onClick={() => submit()}
          disabled={send.isPending}
          style={{ fontWeight: 600, color: '#1d4ed8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
        >
          Resend email
        </button>
      </p>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
        If you don't see the email in your inbox, please check your spam or junk folder.
      </p>

      <ErrorAlert message={serverError} />

      <Button asChild size="lg" className="mt-6 h-11 w-full" data-test-id="fp-back-btn">
        <Link to="/login">Back to login</Link>
      </Button>
    </div>
  ) : (
    <div style={{ width: '100%' }}>
      <h1 style={{ fontSize: 32, fontWeight: 400, color: '#0a1929', marginBottom: 8, fontFamily: "Georgia, 'Times New Roman', serif", letterSpacing: '-0.02em' }} data-test-id="fp-heading">
        Forgot password?
      </h1>
      <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 32 }}>
        Enter your username and we'll send you reset instructions.
      </p>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }} data-test-id="fp-form">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label htmlFor="fp-username">Username</Label>
          <Input
            id="fp-username"
            autoFocus
            autoComplete="username"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            data-test-id="fp-username-input"
          />
        </div>

        <ErrorAlert message={serverError} />

        <Button type="submit" size="lg" className="h-11 w-full" disabled={send.isPending} data-test-id="fp-submit-btn">
          {send.isPending && <LoaderCircle className="size-4 animate-spin" />}
          Send reset instructions
        </Button>
      </form>

      <Link
        to="/login"
        style={{ display: 'block', marginTop: 20, textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#6b7280', textDecoration: 'none' }}
        data-test-id="fp-back-link"
      >
        Back to login
      </Link>
    </div>
  )

  return (
    <main style={{ display: 'flex', minHeight: '100vh' }} data-test-id="fp-root">
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
        data-test-id="fp-auth-panel"
      >
        <div style={{ width: '100%', maxWidth: 420 }}>
          {formContent}
        </div>
      </div>
    </main>
  )
}
