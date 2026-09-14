---
name: content-security-policy
description: The app is served under a Content-Security-Policy the app's OWNER configures on the platform — you neither write it nor read it, and there is nothing to wire up. Load this when a browser request is blocked by CSP (a fetch, an image, a font, an embedded iframe, a script CDN) so you route the user to the setting instead of coding around it, and before editing app/index.html so you don't delete the block that carries the policy.
version: 1
---

# CSP — not yours to write, and not yours to work around

Every app is served with a `Content-Security-Policy`. It is the platform's shared default
set plus whatever the app's owner has configured on the app's interface record
(**Interface settings → CSP Manager**). The engine sends it on the preview, the deploy
server sends it on the published app, and the build bakes a copy into `index.html`.

**None of that is your job.** Unlike the [password policy](../password-policy/SKILL.md),
there is no hook to call and no data to fetch — the app's code does not participate at
all. Your entire responsibility is the two things below.

## 1. Leave the `ua:csp` block in `index.html` alone

`app/index.html` ships an empty marked slot:

```html
<!-- ua:csp --><!-- /ua:csp -->
```

The build writes the app's policy into it. Delete it — or rewrite `<head>` in a way that
drops it — and **nothing fails and nothing warns**: the app just quietly stops carrying
its policy anywhere it is hosted outside the platform. Same rule as the
`<!-- ua:theme-font -->` block right next to it: the markers are engine-owned, keep them.

Never add a `<meta http-equiv="Content-Security-Policy">` of your own. A second policy
does not widen the first — **the browser intersects them**, so a tag you write to "allow"
something can only ever take permissions away, including from the real policy the owner
configured.

## 2. A CSP-blocked request is a SETTING, not a bug to code around

In the browser console it reads roughly:

```
Refused to connect to 'https://api.acme.com/orders' because it violates the following
Content-Security-Policy directive: "connect-src 'self' https://*.unifyapps.com ..."
```

`connect-src` for a fetch/XHR/websocket, `img-src` for an image, `font-src` for a font,
`frame-src` for an embed, `script-src` for a third-party script.

**The fix is one entry in the app's settings, and only the owner can make it:**

> Interface settings → CSP Manager → Resource Control → add `https://api.acme.com`.

Say that. Then stop. Do **not**:

- proxy the call through another origin to dodge the directive;
- inline a remote script or base64 an asset to get it past `script-src`/`img-src`;
- swap a blocked provider for a different one without being asked;
- add the meta tag from §1 hoping to allow it.

Each of those turns a thirty-second setting change into a permanent workaround in the
user's codebase, and the second one hides a real request behind a shape nobody will
recognise later. A blocked request means the app is reaching somewhere the owner has not
listed — that is the policy doing its job, and the owner is the only one who gets to
decide it should be allowed.

**The policy is enforced by default**, so a violation means the request genuinely did not
happen — the data is missing, the image is broken, the embed is blank. Don't read the
symptom as a bug in your own code and start rewriting the fetch; read the console first.

An app whose owner has explicitly switched enforcement off gets
`Content-Security-Policy-Report-Only` instead, which logs the violation and lets the
request through. There the symptom is a working app with a console warning — still worth
telling the user about, because it breaks the day enforcement goes back on, and still not
worth working around.

## What you may still be asked to do

Building a login page, a signup form, an embedded view — all normal work, none of it
changes because of CSP. Build it; if something it loads is blocked, follow §2.
