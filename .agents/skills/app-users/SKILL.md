---
name: app-users
description: How to create a SIGN-IN ACCOUNT (a login) for the app being built, using the create_app_user tool — it creates the platform user and grants them access to this app in one call. Load this whenever the user asks to add a user, create a login/account, invite someone, or give a person access to the app. This is NOT about building a users/agents SCREEN inside the app (that is ordinary app data); it is about who can sign in.
version: 1
---

# App users — creating a sign-in account

A person who can **sign in** to the generated app is a platform user with a role
mapping onto this app. That is a platform record, not app code — you do not build it,
you create it with the **`create_app_user`** tool.

Do NOT tell the user that logins "are managed in platform settings" and send them away.
You can create one directly. Deflecting is the failure this skill exists to prevent.

## Which request is this?

"Create a user" is genuinely ambiguous — read the intent, and when it is unclear, ask
ONE short question rather than guessing:

| The user means | What to do |
|---|---|
| A **login / sign-in account / access** for a person ("create a user for this app", "add me a login", "invite Priya") | `create_app_user` — this skill |
| A **users/agents/staff screen INSIDE the app** (records that tickets get assigned to, a team directory) | Ordinary app data — a page + entity/store. Not this skill, and not `create_app_user` |

They are not exclusive: an ITSM app may want both an agents table AND real logins. If the
answer is "both", do both.

## Creating the account

Call `create_app_user` with:

- **`name`** — the person's display name ("Priya Nair").
- **`username`** — their login handle, unique within the app. If the user gave you an
  email, that is normally the username too.
- **`password`** — omit it. One is generated and returned to you, which is safer than
  reusing a house default.
- **`custom_properties`** — values for **REQUIRED** custom properties only.
- **`role_ids`** — omit unless the user named specific roles. Empty grants plain app
  access, which is the usual case.

The tool targets **the app you are building** — you never pass an application id, and you
cannot create a user in anyone else's app.

### Required custom properties — ask, don't invent

The tool reads the user schema and fills any REQUIRED custom property you didn't supply
with a **placeholder**. A placeholder is a last resort, not the plan:

- If the field is something only the user can know — an email/UPN, an employee id, a
  department — **ask them for it** and pass the real value. One short question beats a
  record full of fabricated data.
- Never pass OPTIONAL properties. A field the user never mentioned should stay unset,
  exactly as it would if a human skipped it in the settings form.
- If the tool reports it used placeholders, **say so in your reply** and name the fields.
  Silently handing over a record with invented values is how bad data becomes permanent.

## Always hand over the credentials

When the tool succeeds it returns the **email/username and the password**. Your reply to
the user MUST include both, verbatim.

The password is generated at creation time and stored nowhere readable — this is the only
time it is ever shown. A reply that summarises ("I've created the user") without the
credentials produces an account nobody can sign into, and the only fix is to create
another one. Give them the details plainly:

> Created **Priya Nair** — she can sign in at the app's login page with:
> - **Username:** priya.nair
> - **Password:** qT8dWi8YQS2A9Aa#
>
> She should change the password after first sign-in.

This is the one case where credentials belong in the chat: the user asked you to create
the account and cannot use it otherwise.

## After it succeeds

- The user can sign in immediately at the app's `/login` route — which exists on every
  app, public or private (see the `authentication` skill).
- Making the app **PUBLIC does not remove the need for accounts** for anything that reads
  per-user data; public only decides whether sign-in is *enforced*.
- Creating a login does **not** create a record in the app's own data. If the app has an
  agents/staff table and this person should appear there too, add that record separately.

## When it fails

- **Username already taken** — pick a different one (add a surname or a number) and say
  what you changed.
- **The login was created but granting app access failed** — this is reported as an error
  and it matters: the account exists but the person cannot sign in to this app. Tell the
  user exactly that rather than reporting success, and offer to retry.
- **No auth session** — an internal problem, not something the user can fix. Say the
  account could not be created and move on; do not retry in a loop.
