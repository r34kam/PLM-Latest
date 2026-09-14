---
name: password-policy
description: How the app's password rules work — they are CONFIG, owned by the app's owner on the platform and enforced by the API, never rules you write. Read them at runtime with usePasswordPolicy() from @/lib/passwordPolicy, render the form from what it returns, and let the API's rejection cover the rules a browser can't check. Load this whenever you build, restyle or review any screen that SETS a password (/update-password, a change-password box in settings) — and to know why sign-in and forgot-password must NOT validate a password at all.
version: 1
---

# Password policy — config, not code

Every app has a password policy: minimum/maximum length, which character classes are
required, how often passwords expire, how many old ones can't be reused. **The app's
owner configures it on the platform** (it lives on the app's interface record) and **the
API enforces it**.

So the rules are data your app reads, not rules your app decides. Write them into the
page and one of two things happens the moment the owner changes the policy:

- your form is **stricter** than the API — you reject passwords the server would accept.
  Annoying.
- your form is **looser** than the API — the user picks a password your form ticks green,
  submits, and gets a rejection with nothing on screen saying which rule they broke. This
  one is the bug; it looks like the app is broken, and no amount of restyling fixes it.

The template already solves this. Use it.

## Use the hook

```tsx
import { usePasswordPolicy } from '@/lib/passwordPolicy'

const { rules, notes, isLoading } = usePasswordPolicy()
```

It reads the policy off the same `/auth/interface` record `AppBuilderProvider` already
uses to resolve PUBLIC vs PRIVATE, so there is nothing to wire up and no app id to pass.
`/update-password` in the template is the worked example — read it before writing a new
password screen.

## Two kinds of rule, used two different ways

`usePasswordPolicy()` splits them for you because they are **not** interchangeable:

| | what it is | how to render it |
|---|---|---|
| `rules` | length + character classes | live checklist with tick state, **and** they gate submit |
| `notes` | expiry days, minimum age, reuse history | plain helper copy — **never** validation |

**Don't validate `notes`.** "Expires every 90 days" is not something a form can check.
Turning it into a field rule blocks a password the API accepts.

## The rules the form stays silent about

A policy can also require "not a common password" (`COMMON_PASSWORDS_PATTERN`) and "no
personal information" (`CONTEXT_SPECIFIC_PASSWORD`). `rules` deliberately **omits** them,
and the form says nothing about them up front. They are still enforced — by the API, whose
rejection message names the rule the user tripped. That is the only place either can be
decided: the browser has no breached-password list and doesn't know the user's name.

So don't add them back:

- **not as a checklist row.** A permanent green tick is a lie; an untickable row is noise
  the user can't act on until they've already typed something and submitted.
- **and above all not as a regex.** A guessed check either fails a password the API would
  accept, or ticks green and gets rejected anyway — the exact gap this skill closes.

What this DOES require: the server's error must reach the screen. Keep the API error
rendered on the page (`/update-password` shows it in the same alert as client validation) —
it is now the only thing that explains these rules.

## Wait for it before accepting a submit

```tsx
const canSubmit = !isLoading && unmetRules.length === 0 && passwordsMatch
```

While the policy is loading the hook returns fallback rules so the form isn't blank — but
they are a guess. Accepting a submission against them re-opens the exact gap this skill
exists to close, so gate the button on `isLoading` (the template does).

## Where this applies — and where it must NOT

Only screens where the user **chooses a new password**:

- `/update-password` — the forced-reset / first-login destination. Already wired.
- a change-password form inside a settings or profile page, if the app has one.

**Never** apply password rules to:

- **the login page.** Signing in checks an EXISTING password. If the owner tightened the
  policy yesterday, every user whose password predates the change still has a valid one —
  validating the sign-in field locks them out of their own app. The password field on
  `/login` gets no rules at all.
- **the forgot-password page.** It collects a username and sends an email; no password is
  set there. (And per the `authentication` skill, the username field never gets validation
  either.)

## When you restyle these pages

Restyling is expected — match the app's look. Keep intact:

- the `usePasswordPolicy()` call and the two lists it drives,
- the `isLoading` gate on submit,
- the requirement list being visible **before** the user submits, not only after a failure,
- the API's error message being rendered somewhere on the page.

If you're rewriting the page from scratch, port those first, then style around them.

## When the owner changes the policy

Nothing to rebuild. The next page load reads the new record and the form follows. If a
user asks you to "update the password rules", they mean the platform setting (builder →
**More → Password policy**), not app code — point them there rather than editing regexes,
because the API reads the setting regardless of what the page says.
