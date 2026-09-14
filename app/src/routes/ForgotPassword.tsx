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

function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-[416px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-border bg-background px-8 py-10 shadow-sm">
      {children}
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

  if (sent) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <AuthCard>
          <div className="text-center">
            <h1 className="font-serif text-2xl font-medium text-foreground">Check your email</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We&rsquo;ve sent reset instructions to your email.
            </p>
          </div>

          <p className="mt-6 text-center text-sm text-foreground">
            Haven&rsquo;t received the email?{' '}
            <button
              type="button"
              onClick={() => submit()}
              disabled={send.isPending}
              className="font-semibold text-primary hover:underline disabled:opacity-50"
            >
              Resend email
            </button>
          </p>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            If you don&rsquo;t see the email in your inbox, please check your spam or junk folder.
          </p>

          <ErrorAlert message={serverError} />

          <Button asChild size="lg" className="mt-6 h-11 w-full">
            <Link to="/login">Back to Login</Link>
          </Button>
        </AuthCard>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <AuthCard>
        <div className="text-center">
          <h1 className="font-serif text-2xl font-medium text-foreground">Forgot your password?</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your username and we&rsquo;ll send you reset instructions.
          </p>
        </div>

        <form className="mt-6 flex flex-col gap-5" onSubmit={submit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="username">Username</Label>
            {/* No validation on the username field — pass it through as typed. */}
            <Input
              id="username"
              autoFocus
              autoComplete="username"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <ErrorAlert message={serverError} />

          <Button type="submit" size="lg" className="h-11 w-full" disabled={send.isPending}>
            {send.isPending && <LoaderCircle className="size-4 animate-spin" />}
            Send reset instructions
          </Button>
        </form>

        <Link
          to="/login"
          className="mt-5 self-center text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          Back to login
        </Link>
      </AuthCard>
    </main>
  )
}
