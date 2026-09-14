import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Check, LoaderCircle } from 'lucide-react'
import { useUpdatePassword } from '@unifyapps/app-builder-sdk/hooks/auth'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { usePasswordPolicy } from '@/lib/passwordPolicy'

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

function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-[416px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-border bg-background px-8 py-10 shadow-sm">
      {children}
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
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <AuthCard>
        <div className="mb-2 text-center">
          <h1 className="font-serif text-2xl font-medium text-foreground">Set a new password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a new password to continue to your account.
          </p>
        </div>

        <form className="mt-6 flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-password">New password</Label>
            <PasswordInput
              id="new-password"
              autoFocus
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <PasswordInput
              id="confirm-password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>

          <ul className="flex flex-col gap-1.5">
            {rules.map((rule) => {
              const met = rule.test(password)
              return (
                <li
                  key={rule.id}
                  className={`flex items-center gap-2 text-sm ${
                    met ? 'text-emerald-600' : 'text-muted-foreground'
                  }`}
                >
                  <Check className={`size-4 shrink-0 ${met ? 'opacity-100' : 'opacity-30'}`} />
                  {rule.label}
                </li>
              )
            })}
            <li
              className={`flex items-center gap-2 text-sm ${
                passwordsMatch ? 'text-emerald-600' : 'text-muted-foreground'
              }`}
            >
              <Check className={`size-4 shrink-0 ${passwordsMatch ? 'opacity-100' : 'opacity-30'}`} />
              Both passwords match
            </li>
            {/* every row here is one the browser can decide. The policy's server-only rules
                (common passwords, your own name/email) are enforced by the API and surface
                in its rejection — see @/lib/passwordPolicy for why they aren't listed. */}
          </ul>

          {notes.length > 0 && (
            <p className="text-xs text-muted-foreground">{notes.join(' ')}</p>
          )}

          <ErrorAlert message={validationError ?? serverError} />

          <Button
            type="submit"
            size="lg"
            className="h-11 w-full"
            disabled={update.isPending || isPolicyLoading}
          >
            {(update.isPending || isPolicyLoading) && (
              <LoaderCircle className="size-4 animate-spin" />
            )}
            Update password
          </Button>
        </form>
      </AuthCard>
    </main>
  )
}
