---
name: theming
description: How the app's colours, font and corner radius actually get set — the platform owns them, the engine bakes them into CSS, and you style through semantic tokens. Load this when the user asks to change the theme or branding, to switch or refresh a platform theme, when you are about to touch a colour/font/radius value anywhere, or when you need to know which token to reach for. Also load it before telling a user something about the theme cannot be done.
version: 3
---

# Theming — what you own and what you do not

The app's **palette, font and corner radius** come from a platform brand theme the user
picked. The engine fetches that theme, maps it to the shadcn token set, and writes it
into the app's CSS before every build. You do not choose these values and you cannot
edit them: the build re-renders that file, so a hand edit is gone by the next preview.

Everything else is still yours — layout, spacing, hierarchy, motion, interaction, copy.

The per-turn `[theme-lock]` block states the current values and their precedence. This
skill is the mechanics: which token to reach for, how to change a theme, and the traps.

## Changing the theme: two different asks

`set_app_theme` is the only way. Read which ask you have:

| the user says | call |
|---|---|
| "use the Ocean theme", gives an `e_theme` id | `set_app_theme(theme_id="e_69a…")` |
| "I updated our theme", "pull in the theme changes", "it doesn't match our branding" | `set_app_theme()` — **no arguments** |
| "make the buttons blue", "less rounded", "bigger headings" | NEITHER — see below |

The no-argument form re-reads the theme this app already follows. Themes are edited
outside the app, in the platform's design system, and the app does not follow those
edits on its own. **Do not ask the user for a theme id first** — the app knows its own.

A request to change ONE value ("make the buttons blue") is not a theme switch. The
theme is a shared brand asset; repainting it for one app is wrong, and editing the CSS
is reverted. Say the palette comes from the platform theme, name the theme, and offer
the two real options: switch to a different theme, or change it in the design system
and ask you to pull it in.

## Which token to reach for

The engine emits the shadcn set. Use the semantic class, never a raw colour:

- surfaces, page outward: `bg-background` → `bg-card` / `bg-popover` → `bg-muted` →
  `bg-secondary`. These map the platform's 4-step elevation ramp, so a card on the page
  and a muted panel on a card are always distinguishable.
- ink: `text-foreground` for body, `text-muted-foreground` for captions and secondary
  lines, `text-card-foreground` on a card. Never put `text-foreground` on `bg-primary`.
- brand: `bg-primary` + `text-primary-foreground`. `accent` is a RECESSED SURFACE, not a
  second brand colour — do not use it for a call to action.
- lines: `border-border`, and `border-input` on form controls.
- focus: `ring-ring`. It is the brand, and it is the one affordance keyboard users have.
- radius: the `rounded-*` scale. It already resolves to the theme's radius, which may be
  `0rem` — if the theme says square, the app is square.

## What the theme does NOT give you

Reaching for these produces classes that resolve to nothing, or to Tailwind defaults:

- **status colours.** Only `destructive` exists. There is no themed success or warning.
- **alpha tokens.** Translucent brand steps are not mapped; use opacity utilities.
- **dark mode may be synthesized.** Many themes ship no dark values, so the dark shell is
  derived. Check both modes look right before you claim the app supports dark mode.

## Traps

- **Everything the theme sets can differ per mode — colour, text, font, border.** All
  four are edited per colour scheme in the theme manager, so check BOTH modes before you
  call a screen done: the type size, the corner radius and the typeface can each change
  when the user flips it, not just the palette. `text-sm` … `text-7xl` are the theme's
  own sizes where it states them.
- **Never write a literal into `@theme inline`.** Tailwind copies a value there into
  every utility it generates, baking it in at build time, where no `.dark` rule can
  reach it — that is why the keys you see point at tokens instead: `--font-sans` →
  `--app-font-sans`, `--text-lg` → `--app-text-lg`, `--color-primary` → `--primary`. The
  per-mode values live in `:root` and `.dark`. The font families also load via a
  `<link>` in `index.html`. All of it is engine-owned; do not touch it.
- **Do not add a weight axis to the Google Fonts URL.** One family that does not serve a
  requested weight 400s the whole request — every font on the page falls back to system.
- **Colours are OKLCH.** Write `oklch(L C H)` if you ever need a literal, and expect the
  theme's own values in that form, including ones the theme authored directly.
- **Never hand-edit** `theme.json`, the token block in the theme CSS file, or the font
  link. All three are re-rendered from the pinned theme on every build.

## When the theme itself is wrong

Follow it anyway. Contrast floors, "keep the accent rare", the corner-radius ceiling —
all suspended where they would change a themed value. The user's theme wins even when it
looks wrong to you.

The one exception: if two of its own colours are genuinely near-identical (body text on
its own background), still follow it, and add ONE short sentence to your final message
naming the pair. Do not fix it, and do not raise it twice.
