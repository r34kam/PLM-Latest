---
name: document-assets
description: How the app ships and renders a file the user attached in chat (a PDF, a logo, a CSV, any document), and how ANY static asset the app ships gets referenced, whoever added it. Attachment bytes already sit on this server in the session's attachments folder, named by the [attachments] note on the message. MANDATORY whenever the user attaches a file the app should display or bundle, pastes a storage/presigned URL ("render this PDF", "use this logo") and asks you to use it, or whenever you add an image or document to app/public/ or app/src/assets/ yourself. Copy the bytes into app/public/ and reference them through import.meta.env.BASE_URL; render PDFs with react-pdf. NEVER write a presigned URL (anything carrying X-Amz-*, Signature=, Expires= or a token query param) into source, and never render a PDF with <iframe>, <embed> or <object>.
version: 2
---

# Document assets: bundle the bytes, render with pdf.js

A file the user attaches in chat is not an upload the app performs at runtime. It is an
asset the app should SHIP. The bytes are already on disk next to the workspace; your job
is to copy them into `app/public/` and reference them by a mount-safe path. The
`file-upload` skill covers the other case, files an END USER of the running app picks at
runtime; do not reach for `useUppy` here.

The referencing rules below are not attachment-specific. They hold for every static
asset the app ships, including images and documents YOU add on your own initiative: a
root-absolute path to `app/public/` breaks the same way whether the file came from the
user or from you.

## Where the file already is

The `[attachments]` note on the user's message names the absolute folder, e.g.
`/app/workspaces/<appId>/<sessionId>/attachments/`. For a PDF the note lists a `.txt`
sidecar (the extracted text, for you to read); the `.pdf` binary sits beside it under the
same name without the `.txt`. If the user refers to a file attached earlier or in another
chat on this app, look under the sibling session folders:
`ls ../*/attachments/` from the app tree finds them.

## Ship it: copy into app/public

```bash
mkdir -p app/public/documents
cp "/app/workspaces/<appId>/<sessionId>/attachments/<original name>.pdf" \
   app/public/documents/vendor-agreement.pdf
```

Rename to a short kebab-case ASCII name. The original name often carries a UUID prefix,
spaces and parentheses; none of that belongs in a URL.

Reference the copy through the Vite base, never by a root-absolute path:

| | |
| --- | --- |
| correct | `` `${import.meta.env.BASE_URL}documents/vendor-agreement.pdf` `` |
| wrong | `'/documents/vendor-agreement.pdf'` |

The app is served under a mount (`/agent-api/preview/b/<appId>/<branch>/` in preview,
elsewhere when published). A root-absolute path resolves against the site root, not the
mount, and 404s in both places. `BASE_URL` is the one value that is right everywhere.

## Images (png, jpg, svg) follow the same rule, with a better default

An attached image ("use this logo", a hero photo, an icon set) is app content like any
document. Prefer copying it into `app/src/assets/` and importing it:

```tsx
import logo from '@/assets/acme-logo.png'
// <img src={logo} alt="Acme" />
```

An import beats the `public/` path for images: Vite emits the hashed URL resolved
against the base for you, so there is no `BASE_URL` string to build, and a wrong
filename fails the build instead of silently 404ing at runtime. Use `app/public/` +
`BASE_URL` only when the path must be constructed at runtime (a filename stored in a
record) or the file needs a stable public name (a downloadable).

An SVG is text. Besides importing it as a URL, you can open it and inline the markup as
a component, which is the right call when it should scale, restyle, or take
`currentColor`. Either way the bytes come from the attachments folder, never from a
pasted storage URL.

Small text files (a CSV of seed rows) can be imported directly with a `?raw` suffix.

## Never a presigned URL in source

A URL whose query string carries `X-Amz-Signature`, `X-Amz-Security-Token`,
`X-Amz-Expires`, `Signature=`, `Expires=` or a `token=` parameter is a presigned link. It
is temporary by construction (typically two hours) and it is enormous; both properties
have shipped real breakage:

- The link dies when the signature expires. An app that stores it renders a working
  preview during the build and an S3 error page for everyone who opens it later.
- The security token runs to ~1.5 KB of base64. Retyping it into source truncated it
  mid-token in a real build, and S3 answered `InvalidToken` from the first click.

The bytes behind the link are already in the attachments folder; copy them from there. If
the user pastes such a URL with no attachment, fetch it ONCE with `curl -o` into
`app/public/` while it is still valid, then reference the local copy.

A durable public URL the user owns (their CDN, their website) may be referenced directly,
but bundling is still the safer default: the app's CSP may not allow the foreign origin,
and their server may move the file.

## Record data re-presigns itself; only app content gets bundled

The presigned link is a snapshot, not the file's address. The durable address is the
platform's own download path (`/file/download/…`-style, what `useUppy` hands back), and
every GET of it answers a 302 with a freshly minted presigned URL. Nothing you build ever
mints or refreshes a signature.

That gives each kind of file its rule:

| the file is | store / reference | why |
| --- | --- | --- |
| record DATA (attachments end users add at runtime) | the durable platform URL from `useUppy` (see the `file-upload` skill) | the platform re-presigns it on every request, for as long as the record lives |
| app CONTENT (a demo document, a logo, seed assets) | a copy in `app/public/`, via `BASE_URL` | resolving the platform URL needs a signed-in caller on the platform origin; a viewer of a published public app has neither |

The user pasting a presigned link usually copied the RESOLVED form out of the address bar
(the browser had already followed the 302). Never store that form anywhere. If the file
is data, ask for or derive the platform path; if it is app content, bundle the bytes.

## Rendering a PDF: react-pdf, never the native viewer

In the builder, the app runs inside a sandboxed preview iframe
(`sandbox="allow-scripts allow-same-origin allow-forms"`). Chrome refuses to run its
built-in PDF viewer inside ANY sandboxed frame, and no sandbox token re-enables it. An
`<iframe src={pdf}>`, `<embed>` or `<object>` renders as "This page has been blocked by
Chrome" with no error you can catch. pdf.js draws to a canvas with plain JavaScript, so
it works in the sandbox and everywhere else.

```bash
bun add react-pdf
```

Configure the worker the Vite way, once, in the viewer module:

```ts
import { pdfjs } from 'react-pdf'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
```

A minimal viewer with working page navigation:

```tsx
import { Document, Page } from 'react-pdf'

function PdfPreview({ url }: { url: string }) {
  const [numPages, setNumPages] = useState<number>()
  const [page, setPage] = useState(1)
  const [hasError, setHasError] = useState(false)

  if (hasError) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        Preview failed to load. Open the PDF in a new tab.
      </a>
    )
  }

  return (
    <Document
      file={url}
      onLoadSuccess={(pdf) => setNumPages(pdf.numPages)}
      onLoadError={() => setHasError(true)}
    >
      <Page pageNumber={Math.min(page, numPages ?? 1)} />
    </Document>
  )
}
```

`Page` takes `scale` (zoom, `1` = 100%) and `rotate` (degrees) as plain props; wire
toolbar controls to state and pass them through. Clamp the page number to `numPages`.
Keep a "download" / "open in new tab" action as a plain `<a href={url} target="_blank">`.
The sandbox block applies only to rendering the PDF inside the frame; a top-level
navigation to the same URL opens fine.

## Never

- A presigned or otherwise expiring URL in source, in a record, or anywhere durable.
- `<iframe>`, `<embed>` or `<object>` pointed at a PDF. Blocked in the sandboxed
  preview, always.
- A root-absolute asset path (`/documents/...`). 404s under the preview mount.
- `useUppy` for a chat attachment. That hook is for files end users pick at runtime;
  chat attachments are already on disk.
- Base64-inlining a document into source. A 70 KB PDF becomes a 100 KB string constant
  that every bundle ships.
- Pointing a document viewer at anything other than the document. A request about a
  file's icon, thumbnail, or artwork changes the visuals AROUND the viewer, never the
  source it renders. A viewer fed the wrong format fails with a generic load error
  that says nothing about why.
- Writing one asset's bytes over another asset's path. The old extension and
  Content-Type keep describing content that is no longer there, so everything
  downstream fails with no hint. New file, new name, own extension.
- A `DOCUMENT_ASSETS`-style map pointing at files that do not exist in `app/public/`.
  If there is no file, return nothing and let the UI show its "preview unavailable"
  state.
