---
name: authentication
description: How authentication works in the generated app — every app is PRIVATE by default (requires sign-in). Public vs private is the INTERFACE's security.type (set via update_app_security), which the SDK resolves automatically once the app passes its application/interface id to AppBuilderProvider; it only decides whether sign-in is ENFORCED. The agent ALWAYS builds and stitches all three auth routes — /login, /forgot-password, /update-password — on EVERY app, public or private, via the SDK auth hooks (@unifyapps/app-builder-sdk/hooks/auth). Load this whenever building any app.
version: 1
---

# Authentication — private by default, resolved from the interface

Every generated app is **PRIVATE by default**: its data lives behind a sign-in.
Public-vs-private is the **interface's `security.type`** (`'PUBLIC' | 'PRIVATE'`), set by
the user in the platform's **Privacy settings** — it is **NOT** a code toggle. The SDK
resolves it automatically: `AppBuilderProvider` (in `main.tsx`) is passed the app's
**application/interface id** (`interfaceId`), fetches `/auth/interface`, reads
`security.type`, and routes data to the authenticated or public endpoints accordingly.
So in code you never "make the app public" — you only decide whether to build a **login
page**.

**The application id is engine-supplied.** It is `import.meta.env.VITE_APPLICATION_ID`
(injected by the engine as build-time env; the value = the session id) and `main.tsx`
already passes it to `AppBuilderProvider`. Never hardcode a literal id, and NEVER delete
the `interfaceId` wiring or remove it from `AppBuilderProvider` /
`useIdentityProviders` — without it the SDK can't resolve the interface. This holds for
BOTH public and private apps.

Authentication is **independent of backend integration** — a `local` (localStorage) app
can still require login, and a `backend` app can be public.

**Always build all three auth pages — on EVERY app, PUBLIC or PRIVATE.** Build/keep and
stitch into the router: **`/login`**, **`/forgot-password`**, and **`/update-password`**
(reset password). The template already ships these routes and reference pages — keep them,
restyle them to match the app, and wire the sign-in surfaces per this skill.
Public-vs-private is the interface's `security.type` (set via `update_app_security`), and
it only decides whether sign-in is **ENFORCED** — NOT whether these pages exist:

- **PRIVATE** (the default) — sign-in is required; the login page is the entry point.
- **PUBLIC** — no sign-in is required to use the app, but the login / forgot-password /
  update-password routes **still exist and stay wired** (optional sign-in). Do NOT remove
  them for a public app.

Never delete or unstitch the login, forgot-password, or update-password routes for any app.

---

# Building a login page (AUTH: login)

The hooks come from **`@unifyapps/app-builder-sdk/hooks/auth`** (the package root
re-exports these too, but prefer the subpath for consistency). Auth hooks in app code
are fine — it is the ENTITY hooks that must never appear there; see `object-data`. Authentication is the browser **session cookie** —
`useAuthLogin` sets it and you redirect; there are no tokens to store or pass in app
code.

```tsx
import { useIdentityProviders, useAuthLogin } from '@unifyapps/app-builder-sdk/hooks/auth'
```

The auth hooks (exact shapes, from the SDK's types — do not guess):

| Hook / fn | Input | Output |
|---|---|---|
| `useIdentityProviders(applicationId?, options?)` | the application/interface id | React Query result; `data` = `{ objects: IdentityProvider[], … }` (a HITS envelope) |
| `useAuthLogin()` | `mutate({ data: { identityProviderId, formData, returnTo? } })` | resolves to `{ redirectUrl, sessionId? }` |
| `getSSOLoginUrl(idpId, returnTo?)` | ids | a URL `string` (direct-redirect alternative for SAML) |
| `useLogout()` | `mutate()` | logs out (clears the session cookie) |
| `useUserContext()` | — | `data` = the current user/customer details |
| `useGetApiUserContext(params?, options?)` | `params` (e.g. `{ includeRoles: true }`) + React Query `options` | `data` = `CurrentUserDetails` — the signed-in user, incl. **roles** (from `@unifyapps/app-builder-sdk/hooks/user`) |
| `useSendForgotPasswordEmail()` | `mutate({ username })` | emails a reset link (public — no session needed) |
| `useUpdatePassword()` | `mutate({ password })` | sets a new password for the signed-in user (requires session) |

## 1. Fetch the identity providers

`useIdentityProviders(applicationId?)` returns a React Query result; the provider
records live under **`data.objects`** — the same "records live under `.objects`" HITS
envelope the `backend-integration` skill teaches for search. Each record is an
`IdentityProvider`.

The `applicationId` argument is the **interface id** (NOT an object `entityType`) — the
same `interfaceId` value main.tsx passes to `AppBuilderProvider`. Read it from the
engine-supplied env (`import.meta.env.VITE_APPLICATION_ID`, injected at build time) —
never hardcode a literal id or invent a URL resolver:

```tsx
// The SDK does NOT re-export the IdentityProvider type — derive it from the hook return.
type IdentityProvider = NonNullable<
  NonNullable<ReturnType<typeof useIdentityProviders>['data']>['objects']
>[number]

// Engine-supplied at build time — never hardcode or delete it.
const interfaceId = import.meta.env.VITE_APPLICATION_ID
// ...
const { data, isLoading, isError } = useIdentityProviders(interfaceId)
```

## 2. Bucket the providers by `type` (the core logic)

An IDP's `type` (+ `configProvider`) decides which sign-in surface it drives. Filter to
**ACTIVE** providers first (`p.active !== false`) — inactive IDPs must not paint a
surface:

```ts
const isSso      = (p: IdentityProvider) => p.type === 'OPEN_ID' || p.type === 'SAML'
const isPassword = (p: IdentityProvider) => p.type === 'PASSWORD' && p.configProvider !== 'OTP'
const isOtp      = (p: IdentityProvider) => p.type === 'PASSWORD' && p.configProvider === 'OTP'
```

Default surface precedence when several exist: **SSO → password → OTP**.

## 3. Render three surfaces

- **SSO** — one button per provider. Label `idp.uiConfig?.button?.value ?? idp.name`,
  optional icon `idp.iconUrl`. Clicking completes login for that provider.

- **Password** — username + password form. Do **NOT** add any client-side validation on
  the **username** field — no email-format check, no regex/pattern, no "looks like an
  email" gating. Treat it as a plain text input and pass whatever the user types straight
  into `formData.username`. (A username may be an email, a handle, or anything the IDP
  accepts; the backend validates it, not the app.)
  **Every password field gets a show/hide toggle** — use the template's
  `PasswordInput` (`@/components/ui/password-input`), an `Input` wrapped with an
  Eye/EyeOff button that flips `type` between `password` and `text`. Don't render a
  bare `<Input type="password" />`.
- **OTP** — username-only form (the OTP is sent, then verified on a later step). Same rule:
  no validation on the username field.

## 4. Complete login with `useAuthLogin()`

Call `mutate({ data: { identityProviderId, formData, returnTo } })`. `formData` shape
per surface, then redirect to the returned `redirectUrl`:

```tsx
const login = useAuthLogin()

function submit(identityProviderId: string, formData: Record<string, unknown>) {
  login.mutate(
    { data: { identityProviderId, formData, returnTo } },
    { onSuccess: ({ redirectUrl }) => { if (redirectUrl) window.location.href = redirectUrl } },
  )
}

// SSO:      submit(idp.id!, {})
// password: submit(idp.id!, { username, password, rememberMe: true })
// OTP:      submit(idp.id!, { username, rememberMe: true })
```

For SAML you may instead redirect directly with `getSSOLoginUrl(idp.id!, returnTo)`
(`window.location.href = getSSOLoginUrl(...)`) rather than going through the mutation.

## 5. Wire it as a route

The login page is a normal route rendering `<Login />` — like every route in the
generated app, under the template's **`BrowserRouter`** (clean URLs, e.g. `/login`),
whose `basename` is already derived from the engine-baked mount path. The template already
ships this route and a reference `Login.tsx`; don't add your own router or change the
basename.

## CRITICAL — never a blank page

Derive the active surface **during render** from the fetched providers, e.g.
`const mode = override ?? defaultMode`, where `defaultMode` comes straight from the
bucketed lists. **Do NOT** set the initial mode in a `useEffect` that writes state:
an effect leaves a blank first frame, and if the fetch errors or returns no providers
the mode never resolves and **nothing paints** (we hit exactly this bug).

```tsx
const { data, isLoading, isError } = useIdentityProviders(applicationId)
const objects = (data?.objects ?? []).filter((p) => p.active !== false)
const ssoIdps = objects.filter(isSso)
const passwordIdp = objects.find(isPassword)
const otpIdp = objects.find(isOtp)

const [override, setOverride] = React.useState<Mode | null>(null) // user switching surfaces
const defaultMode: Mode | null =
  ssoIdps.length ? 'sso' : passwordIdp ? 'password' : otpIdp ? 'otp' : null
const mode = override ?? defaultMode // resolved DURING render, not in an effect
```

Always render explicit **loading / empty / error** states so the page is never blank:

```tsx
if (isLoading) return <Spinner />
if (isError) return <ErrorCard message="Could not load sign-in options." />
if (!mode) return <ErrorCard message="No sign-in methods are configured for this application." />
```

# Reset & update password

Two optional surfaces beyond sign-in, same import
(`@unifyapps/app-builder-sdk/hooks/auth`). They are **independent of the login page** —
build either only when the plan asks for it.

- **Forgot password** (logged-OUT) — `useSendForgotPasswordEmail()` emails a reset link.
  Anonymous like `useIdentityProviders`: **no session required**, so it belongs next to
  the login surfaces. Collect a username/email and `mutate({ username })`. Same
  **no username validation** rule as the login surfaces — pass whatever the user types
  through; the backend decides whether an account exists (and by design the response does
  not reveal whether it did, so always show the same "check your email" confirmation).
- **Update password** (logged-IN) — `useUpdatePassword()` rotates the current user's own
  password. **Requires an active session** (identity comes from the session cookie), so
  build it only behind a signed-in surface (a settings / profile page), **never** on the
  public login page. `mutate({ password })` with the new password; on success the backend
  invalidates the user's other sessions.

```tsx
import { useSendForgotPasswordEmail, useUpdatePassword } from '@unifyapps/app-builder-sdk/hooks/auth'

// forgot password (public — no session):
const forgot = useSendForgotPasswordEmail()
forgot.mutate({ username })              // → emails a reset link

// update password (signed-in only):
const update = useUpdatePassword()
update.mutate({ password: newPassword }) // → sets the new password, logs out other sessions
```

**The SDK only triggers the reset email.** Setting the new password from the emailed
link is handled by the platform's hosted reset page — the SDK does **not** expose that
step, so a generated app collects the username, fires `useSendForgotPasswordEmail`, and
tells the user to check their inbox. Don't try to build the set-new-password screen.

## Stitch both routes whenever you build a login page

The template **already ships both routes** — `ForgotPassword.tsx` (`/forgot-password`)
and `UpdatePassword.tsx` (`/update-password`), both wired in `App.tsx` — exactly like it
ships `Login.tsx`. So **whenever you stitch a password login, keep and restyle these two
routes to match your login page** (same card, typography, and theme); do NOT delete them,
add your own router, or change their paths:

- **`/forgot-password`** — the login page's "Forgot password?" link already points here.
  Step 1 collects the username and calls `useSendForgotPasswordEmail().mutate({ username })`;
  step 2 shows the "check your email" confirmation (with a resend + back-to-login). No
  username validation.
- **`/update-password`** — the destination the SDK **auto-redirects to** when the backend
  returns an expired-password / first-login response (`x-ua-expired-password`, handled
  inside the SDK's fetch layer). It collects a **new password + confirm**, enforces the
  app's configured password policy via `usePasswordPolicy()` (**never hardcode the rules**
  — load the `password-policy` skill), gives
  both fields the show/hide eye toggle (`PasswordInput`), calls
  `useUpdatePassword().mutate({ password })`, and on success sends the user back to
  `/login` (the change invalidates the session, so they re-authenticate with the new
  password). This is why it can stand alone as its own route even though the hook needs a
  session — the redirect only fires for a user who just authenticated.

Match them to the login page's look, but keep the hooks, the paths, the validation, and
the redirect-to-`/login`-on-success behavior intact.

# Reading the signed-in user (and their roles)

**PRIVATE apps only — never call user-context on a PUBLIC app.** `useGetApiUserContext`
and `useUserContext` require an **authenticated session** (`/api/user-context` needs a
signed-in user). On a PUBLIC app the visitor is anonymous with NO session, so these calls
**fail** (401 / empty user). So:

- Use them ONLY when the app's `security.type` is **PRIVATE** (every visitor is
  authenticated).
- If the app is **PUBLIC**, do **NOT** use `useGetApiUserContext` / `useUserContext` at
  all — and if a build already added them (e.g. role-gating), **remove them**. There is no
  user to read; drive the UI off public data instead.

On a PRIVATE app, read the logged-in user's context — identity, customer, and **roles** —
with `useGetApiUserContext` from **`@unifyapps/app-builder-sdk/hooks/user`**. Pass
`{ includeRoles: true }` for roles (also `includeTeams: true` for teams). Use it to gate
UI by role (admin-only actions, nav, etc.) — not to decide public-vs-private, which the
interface's `security.type` already owns.

```tsx
import { useGetApiUserContext } from '@unifyapps/app-builder-sdk/hooks/user'

const {
  data,
  isPending,
  isLoading: isLoadingUserContext,
} = useGetApiUserContext(
  { includeRoles: true },
  {
    query: {
      enabled: isLoggedIn,          // only fetch once the user is authenticated
      staleTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
    },
  },
)

// data is `CurrentUserDetails`: the user is at `data.user`, roles at `data.user.roles`
// (a RoleDefinition[], only populated because of includeRoles), customer at `data.customer`.
const roles = data?.user?.roles ?? []
const isAdmin = roles.some((r) => r.name === 'Admin')
```

- **Gate the query on being logged in** (`query.enabled: isLoggedIn`) so it never fires
  for an anonymous visitor — the call needs a session and 401s without one.
- Roles are **only** present when you pass `includeRoles: true`; without it `data.user.roles`
  is undefined.
- This is a normal React Query result — always handle `isPending`/`isLoading` and the
  empty case, and read roles off `data.user.roles` (never assume they're at the top level).

## Rules

- **Private by default.** Every app requires sign-in unless the interface's
  `security.type` is `PUBLIC` (set by the user in Privacy settings). Public-vs-private is
  NOT a code toggle — the SDK resolves it from the interface once you pass `interfaceId`.
- **Application id is engine-supplied.** `main.tsx` (and the login page) read
  `import.meta.env.VITE_APPLICATION_ID`, injected by the engine at build time — never
  hardcode a literal id or DELETE the wiring, for public AND private apps. Without it
  the SDK can't resolve the interface or load identity providers.
- **Always build the auth routes.** `/login`, `/forgot-password`, `/update-password` are
  built and stitched on EVERY app, public or private. `security.type` only decides whether
  sign-in is ENFORCED, not whether the pages exist. Set PUBLIC only via
  `update_app_security` on explicit user request.
- **Never hardcode password rules.** They are the owner's config, read at runtime via
  `usePasswordPolicy()` — see the `password-policy` skill. And they apply ONLY where a
  password is SET (`/update-password`): validating the LOGIN password field locks out
  every user whose password predates a policy change.
- **Never call user-context on a PUBLIC app.** `useGetApiUserContext` / `useUserContext`
  need an authenticated session; a public app's visitors are anonymous, so the calls 401.
  Use them only on PRIVATE apps; remove any user/role usage from a public app.
- **Auth is independent of persistence.** Decide login-vs-public from whether the app
  has real users/accounts, NOT from whether data is `local` or `backend`.
- **Auth import path:** login/identity hooks import from
  `@unifyapps/app-builder-sdk/hooks/auth` (`useIdentityProviders`, `useAuthLogin`,
  `getSSOLoginUrl`, `useLogout`, `useUserContext`, `useSendForgotPasswordEmail`,
  `useUpdatePassword`). The parameterized user-context hook `useGetApiUserContext`
  (roles/teams via `{ includeRoles: true }` / `{ includeTeams: true }`) imports from the
  separate `@unifyapps/app-builder-sdk/hooks/user` subpath.
- **Login pages must never blank out:** derive the sign-in surface DURING render from
  the fetched providers (never in a `useEffect` that sets state), filter to ACTIVE
  providers, and always render explicit loading / empty ("no sign-in methods
  configured") / error states.
- **Auth is the browser session (cookie)** — `useAuthLogin` sets it and you redirect;
  no tokens to store or pass in app code.
- **No username validation.** The password/OTP surfaces must NOT validate the username
  field (no email-format check, no regex/pattern gating). Accept any text and pass it
  through as `formData.username`; the backend is the source of truth. You may still keep
  the field `required` so an empty submit is prevented — that is not format validation.
- **Stitch the reset routes with the login page.** When you build a password login, keep
  and restyle the template's shipped `/forgot-password` and `/update-password` routes —
  don't delete them or change their paths. Keep their hooks
  (`useSendForgotPasswordEmail` / `useUpdatePassword`), the update-password policy (≥8
  chars, ≥1 uppercase, ≥1 special char, confirm-matches), and the redirect-to-`/login`
  on a successful update.
