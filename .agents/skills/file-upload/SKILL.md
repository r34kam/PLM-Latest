---
name: file-upload
description: How the generated app uploads files — images, avatars, attachments, documents, CSVs, anything the user picks from disk, drops on a dropzone, or captures. There is exactly ONE way, `useUppy` from `@unifyapps/app-builder-sdk/hooks/upload`, and it hands back a stored URL you persist on a record. MANDATORY whenever the app has any file/image input — load it BEFORE writing an `<input type="file">`, a dropzone, an avatar picker, or an attachments field. NEVER hand-roll an upload (fetch + FormData to /api/uploads), never base64 a file into a record, never keep a `blob:` URL as if it were storage.
version: 1
---

# File upload — `useUppy`, and nothing else

Any file the user provides goes to UnifyApps storage through **`useUppy`**. It returns a
**URL**; the URL is what you store on a record. The bytes never live in your app state,
never in a record field, never in localStorage.

```ts
import { useUppy } from '@unifyapps/app-builder-sdk/hooks/upload'
```

**Already wired — nothing to mount.** `AppBuilderProvider` in `main.tsx` already provides
the uploader. Do not add a provider, do not edit `main.tsx`, do not install `uppy`.
The uploader boots lazily on the first `useUppy()` in the tree, so an app with no file
input pays nothing for it.

## The hook

```ts
const {
  files,        // UploadedFile[] — this hook's files only, in the order added
  isUploading,  // true while any of them is still going
  isReady,      // the uploader finished booting
  error,        // set only if the uploader could not start at all
  addFiles,     // (FileList | File[]) => Promise<UploadedFile[]>
  removeFile,   // (id: string) => void
  clearFiles,   // () => void
  retryFile,    // (id: string) => void
} = useUppy({
  referenceId: `product-${productId}-image`,  // optional — see "The referenceId"
  accessScope: 'PUBLIC',              // see "Who may read it" — defaults to PUBLIC
  maxFileSize: 5 * 1024 * 1024,       // optional, bytes
  maxNumberOfFiles: 5,                // optional
  allowedFileTypes: ['image/*', '.pdf'],  // optional, MIME patterns or extensions
  onUploadSuccess: (file) => {},      // optional
  onUploadError: (file) => {},        // optional
})
```

Uploads start the moment a file is added — there is no separate "start" call.

Each `useUppy()` gets its own slice of the shared uploader, so two upload surfaces on one
screen never see each other's `files`. Call it once per surface; don't lift one call up
and share its `files` across unrelated fields.

## The referenceId — what makes a surface unique

There is **one** Uppy instance for the whole app. `referenceId` is what carves it into
independent surfaces: every event is filtered by it, and it is prefixed onto the file name
before the file is added, so the same file picked in two places gets two distinct ids
instead of one upload silently overwriting the other.

**It defaults to a generated id, and for most surfaces that is correct** — a single upload
field on a page that stays mounted needs nothing from you.

**Pass your own when the surface can unmount and come back**, and derive it from *what is
being uploaded to* so it is the same string every time that surface exists:

| surface | referenceId |
| --- | --- |
| upload field inside a dialog / sheet | `` `product-${productId}-image` `` |
| one upload cell per row in a table or list | `` `attachment-${row.id}` `` |
| several distinct fields on one form | `` `${recordId}-logo` `` and `` `${recordId}-banner` `` |
| a single field on a page that never unmounts | omit it |

Why it matters: a generated id is **new on every mount**. Close a dialog mid-upload and
reopen it, and the surface no longer recognises its own in-flight files — the progress bar
comes back empty and the finished URL is lost. With a stable `referenceId` the hook
re-attaches on mount and recovers those files, including ones that completed while the
component was gone. (The local `previewUrl` does not survive a remount — it is a `blob:`
URL that is released on unmount — so render `previewUrl ?? url` and the recovered file
still shows correctly.)

**Two rules:**

1. **Unique per surface.** Two hooks sharing a `referenceId` share one file list — each
   sees the other's uploads. Never reuse one string across different fields.
2. **Stable across mounts.** `` `row-${index}` `` breaks when the list re-sorts; use the
   record's id, not its position. Never `Math.random()`, `Date.now()`, or a `useState`
   default — those are just a worse generated id.

## Which cloud storage does it upload to?

**Not your decision, and there is nothing to configure.** The uploader asks the platform
which storage the tenant runs on (`/api/file/cloud-storage-provider`) while it boots, and
picks the right path itself:

| tenant provider | how the file goes up |
| --- | --- |
| `s3` | S3 multipart, direct to the bucket, negotiated through the platform |
| `nfs` / `unifyapps` (Azure) | chunked through the platform's own upload API |

Same `useUppy` call, same `UploadedFile` back, either way. Never branch on the provider,
never ask the user which storage to use, and never put a bucket name, region, endpoint or
key in the app — the app never sees any of them.

The one place it shows through is `accessScope: 'PUBLIC'`: on a bucket that accepts public
objects you get a plain `https://…` URL, and on one that doesn't the platform serves the
file through an authenticated path instead. Both come back in `url` and both render — you
do not handle the two cases differently.

## The output structure

`addFiles` resolves to — and `files` contains — this shape:

```ts
interface UploadedFile {
  id: string        // stable; use it as the React key and for removeFile/retryFile
  name: string      // sanitized file name as stored
  size: number      // bytes
  type: string      // MIME, e.g. 'image/png'
  status: 'uploading' | 'success' | 'error'
  progress: number  // 0-100
  url?: string      // ← THE VALUE YOU PERSIST. Present only when status === 'success'
  previewUrl?: string  // local blob: URL, available immediately. Preview ONLY — never persist
  error?: string    // human-readable reason, when status === 'error'
  key?: string      // object-storage coordinates, when the provider returned them
  bucket?: string
}
```

Three things follow from that shape, and getting any of them wrong ships a broken app:

1. **`url` is the only thing worth saving.** Not `previewUrl` (a `blob:` URL that dies with
   the tab), not `id` (uppy's, not the backend's), not the `File` object.
2. **`url` is absent until `status === 'success'`.** Never write a record with
   `url: undefined` and "fix it later" — `await addFiles(...)` first, then save.
3. **Render `previewUrl ?? url`.** The preview exists instantly; the stored URL arrives at
   the end. That one expression gives an image thumbnail with zero perceived latency.

## `addFiles` — what it resolves to

`await addFiles(fileList)` resolves **after every file in the batch has settled**, to one
`UploadedFile` per input file. It does **not** reject when a single file fails: that file
comes back with `status: 'error'` and a message in `error`. Check the status.

```ts
const results = await addFiles(event.target.files ?? [])
const uploaded = results.filter((file) => file.status === 'success')
const failed = results.filter((file) => file.status === 'error')
```

It rejects only if the uploader itself never started (no network, misconfigured tenant) —
the same condition the hook's `error` field reports.

Files rejected by `maxFileSize` / `maxNumberOfFiles` / `allowedFileTypes` are checked
**before** the upload starts: they come back in the resolved array with `status: 'error'`
and are **not** added to `files`. Surface `error` on those to the user (a toast is fine);
they are user mistakes, not failures.

## Who may read it — `accessScope`

| scope | who can read the file | use it for |
| --- | --- | --- |
| `'PUBLIC'` *(default)* | anyone with the link, no sign-in | anything the app **displays**: avatars, product images, logos, gallery photos, public attachments |
| `'APPLICATION'` | users of this app | files that should not leak outside the app |
| `'USER'` | only the uploader | private documents, personal ID uploads |
| `'ALL_USERS'` | any signed-in user of the tenant | shared internal documents |

**Default to `'PUBLIC'` for anything rendered in an `<img>`, `<video>`, or a download
link.** A non-public URL is authenticated: it resolves in the deployed app (same origin,
real session) but a plain `<img src>` from the dev server or the engine preview is
cross-origin and will 401 — so a restricted image looks "broken" in preview even though
the upload succeeded. Only pick a narrower scope when the plan actually calls for
restricted files, and say so in your summary if previews will look empty because of it.

## Persisting the URL

A backend app stores the URL like any other field — a plain `string` (or `string[]` for
multiple attachments) on the object. Add the field with `create_object` / `update_object`,
then write it through the normal `CREATE` / `UPDATE` binding (see the `object-data` skill).

```ts
const [uploaded] = await addFiles(event.target.files ?? [])
if (uploaded?.status !== 'success') return toast.error(uploaded?.error ?? 'Upload failed')
await createProduct({ name, imageUrl: uploaded.url })
```

Never store the file itself: no base64 data URLs in a record, no `File` in zustand, no
`blob:` URL anywhere durable.

## A complete surface

```tsx
type Props = { productId: string; value?: string; onChange: (url?: string) => void }

function ProductImageField({ productId, value, onChange }: Props) {
  const { files, isUploading, addFiles, removeFile } = useUppy({
    // stable, because this field lives in a dialog that unmounts when closed
    referenceId: `product-${productId}-image`,
    accessScope: 'PUBLIC',
    maxNumberOfFiles: 1,
    maxFileSize: 5 * 1024 * 1024,
    allowedFileTypes: ['image/*'],
  })
  const file = files[0]

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const [uploaded] = await addFiles(event.target.files ?? [])
    if (uploaded?.status === 'success') onChange(uploaded.url)
    else if (uploaded?.error) toast.error(uploaded.error)
  }

  const preview = file?.previewUrl ?? value

  return (
    <div className="space-y-2">
      {preview ? <img src={preview} alt="" className="size-24 rounded-md object-cover" /> : null}
      {isUploading ? <Progress value={file?.progress ?? 0} /> : null}
      <Input type="file" accept="image/*" onChange={handleChange} disabled={isUploading} />
      {file ? (
        <Button variant="ghost" size="sm" onClick={() => { removeFile(file.id); onChange(undefined) }}>
          Remove
        </Button>
      ) : null}
    </div>
  )
}
```

Drag-and-drop is the same call — take `event.dataTransfer.files` and pass it to `addFiles`.

## Never

- `fetch('/api/uploads', { body: formData })`, or any hand-rolled upload request. The real
  flow negotiates the tenant's storage provider, chunks large files, and resolves a
  readable URL afterwards. A hand-rolled POST skips all of it and 403s or orphans the file.
- Installing `uppy`, `react-dropzone`'s uploader, `filepond`, or any other upload library.
- `FileReader` → base64 → store in a record. It bloats the record, breaks on anything
  over a megabyte, and there is no URL to render later.
- Keeping `previewUrl` after the upload finishes, or persisting it anywhere.
- Reading `file.url` before `status === 'success'`.
- Adding a second `AppBuilderProvider`, an `UppyProvider`, or editing `main.tsx`.
