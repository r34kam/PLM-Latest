---
name: artifact-plan
description: PLAN.md format for specifying a single-page HTML/CSS/JS app before building it
version: 2
---

# Page plan skill

When asked to plan a single-page app, produce a `PLAN.md` at the workspace root that
opens with this title line, then has exactly these four sections and nothing else.

```
# <App Name> Plan — <one-line description>
```

The title is the FIRST line of the file and it names the app AND says what it is:

- **Before the em dash**: the app's display name followed by the word `Plan` — the same
  name you pass to `set_app_name`, verbatim.
- **After the em dash**: what the app is, in one Title Case noun phrase of 3-8 words,
  no trailing period. `Split Bills Across a Group`, not `A Useful Little Tool`.

## APP

Four lines, no more:

- **Name:** the display name, matching the title.
- **What it is:** one sentence a stranger understands.
- **Who it's for:** one line.
- **The one thing it must do well:** one line. This is what the design serves, and what
  you cut toward when the page gets crowded.

## SECTIONS

The page top to bottom, in order, one bullet each: what the section is, what it shows,
and what the visitor can do there. Name the actual content — "a three-column pricing
table with the middle plan marked Most Popular" — never "a pricing area". Between three
and seven sections; a page that needs more than seven wants to be two products.

When a section is a REPEATED SET keyed by something — board columns, tabs, filter chips,
a legend — say so as a set and name the keys once: "five columns rendered from the stage
list: Backlog, To Do, In Progress, Review, Done". Do not spell them out as five separate
sections. A plan that names each one invites the builder to hand-write five blocks of
markup and then look each one up by a name it retyped, which is where the key gets
spelled two ways and the render loop throws on the one that disagrees.

## INTERACTIONS & STATES

Every behaviour that is not a static read, one bullet each: what triggers it, what
changes, and what it looks like while it happens. Cover the states that get forgotten —
empty, loading, error, success, no-results, first-visit — and say plainly which of them
this app can actually reach; inventing a loading state for a page that loads nothing is
worse than omitting it. Name where state lives: in memory for the session, or
`localStorage` to survive a reload.

## DESIGN SYSTEM

Concrete values a builder can type, never adjectives:

- **Palette:** background, foreground, primary, accent, muted, border, plus the dark
  values — all OKLCH, and all written into `theme.json` (below).
- **Type:** the family (a real Google font), the scale for h1/h2/h3/body/small, and the
  weights actually used.
- **Rhythm:** the spacing step, the max content width, the corner radius.
- **Motion:** what animates, over how long, on which easing.
- **The one thing that makes it feel like itself:** a single deliberate choice — a
  gradient, a texture, an oversized numeral, an unusual grid, a typographic pairing.
  Name it, and say where it appears.

## Also write `theme.json`

`PLAN.md` describes the design; `theme.json` at the workspace root is what the ENGINE
renders into `app/theme.css`, and the app is unthemed without it — the builder would be
designing against the template's grayscale default. Same schema the platform uses:

```json
{
  "font": {
    "sans": "Inter",
    "heading": "Instrument Serif",
    "googleHref": "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Instrument+Serif&display=swap"
  },
  "light": {
    "background": "oklch(0.99 0.005 260)",
    "foreground": "oklch(0.2 0.02 260)",
    "primary": "oklch(0.55 0.16 260)",
    "primary-foreground": "oklch(0.99 0 0)"
  },
  "dark": {
    "background": "oklch(0.15 0.02 260)",
    "foreground": "oklch(0.97 0.01 260)",
    "primary": "oklch(0.68 0.16 260)",
    "primary-foreground": "oklch(0.18 0.02 260)"
  }
}
```

Both `light` and `dark` are required, and each needs at least `background`,
`foreground`, `primary` and `primary-foreground` — a theme missing any of them is
skipped whole as malformed. Add `card`, `card-foreground`, `muted`,
`muted-foreground`, `accent`, `accent-foreground`, `border`, `input`, `ring` and
`radius` when the design calls for them; anything you leave out keeps the template's
value.

**Do not write** a data model, an API surface, routes, an auth story or a build plan.
This product has none of those: one page, no backend, no dependencies.

## Scope

Match the plan to the ask. A deliberately capped request — "a countdown timer", "hello
world", "just something simple" — gets a name, a theme if it warrants one, and NO
`PLAN.md` at all; forcing four sections onto it builds the user a product they
explicitly did not ask for. Anything with real content, or more than one interaction,
gets the full plan.
