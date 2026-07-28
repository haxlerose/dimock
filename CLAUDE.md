# Dimock Camp Meeting Ground — Site Notes

Static HTML site for a Methodist camp meeting ground in Dimock, PA (est. 1877).

`AGENTS.md` is a symlink to this file — edit this one.

**The founding year is 1877 — do not "fix" it to 1875.** `about.html` narrates a
lot of 1875 (the grounds were leased that July, the first camp meeting-style
preaching was August 25, 1875), so 1875 looks like the founding year from that
page alone. It is not. The grounds were chartered August 15, 1877, the signage on
the property reads "Since 1877", and the 150th year is 2027 — which only works
from 1877. `events.html` agrees: 2026 is the 149th season. Confirmed by the owner
2026-07-27. `about.html` is the source of truth for the *events* of the history,
not for the founding year.

**`about.html` describes the past. Do not lift its numbers into the present
tense.** It is a history, so most figures in it are historical, and a few read
like present-day facts about the grounds when they are not:

| Figure in `about.html` | Actually |
|---|---|
| "about 100 cottages" | The heyday count, in a paragraph about tents and 1918. **Today it is around 30.** |
| "the 23.2-acre grounds" | The 1875 lease from Col. Olney Bailey, before the association bought the property. Still about 23 acres — confirmed by the owner 2026-07-28. |

Both of these went onto the homepage as present-tense claims in Phase 5 and one
was wrong. Before stating a number about the grounds *as they are*, check whether
the sentence you took it from is describing 1875.

## Design authority

**Read `docs/design-direction.md` before making any visual change**, and
`docs/redesign-plan.md` before doing any of the work. The first carries the approved
palette, typography, component system, and accessibility standards; the second is the
phased implementation plan with checkboxes tracking what has shipped. This file
describes the code as it stands today; those describe where it is going. Where they
disagree about intent, the design direction wins.

`docs/` is gitignored — those documents are local to this working copy and are not in
the repository. If they are missing, the redesign has to be replanned before it can
continue; do not guess at the direction from the code alone.

## Verifying changes

```bash
checks/run.sh            # all specs, desktop + mobile; non-zero exit on any failure
checks/run.sh --shots    # same, plus screenshots into docs/screens/ for review
```

`checks/` is a Playwright harness that serves the site on port 8811 and asserts, for
every page at 1440×900 and 390×844: no console errors, exactly one `<h1>`, and zero
horizontal overflow — plus whatever the current redesign phase has added (contrast
ratios, nav and footer identity across pages, per-page metadata). Run it before every
commit that touches HTML or CSS. A passing run is necessary but not sufficient —
`--shots` exists to be looked at.

**`checks/` is never deployed.** `.claude/commands/deploy.md` excludes it alongside
`backup/`.

Three environment facts, because each costs a turn to rediscover: Playwright is not
installed locally, so resolve it with
`eval "$(node ~/.claude/skills/playwright-gotchas/scripts/resolve-playwright.mjs)"`;
the module is CommonJS, so use `createRequire` rather than `import { chromium }`; and
`launch()` must be passed `executablePath: process.env.PW_EXECUTABLE` because the
installed browser revision differs from the module's pinned one.

The harness is four files, each with one job: `contrast.mjs` (WCAG arithmetic, no
browser), `specs.mjs` (the rules — **the only file that grows each phase**),
`site-check.mjs` (the runner), and `run.sh` (server up, checks, server down). Adding a
rule means editing `specs.mjs` only. Screenshots land in `docs/screens/`, which is
gitignored.

## Stack

- **Bootstrap 5.3.1** via CDN, with SRI `integrity` hashes — keep them
- **Fraunces + Inter** via Google Fonts, with two `preconnect` links. All three
  `<link>` tags sit between the Bootstrap stylesheet and `site.css`, identically on
  all six pages
- **`site.css`** — the shared stylesheet, linked by all six pages
- No JS framework — Bootstrap bundle JS only
- **No build step.** No bundler, no Sass, no package manager, no CMS. Every
  deployed file exists in the repo, and pages stay hand-editable by a non-developer.
- The host runs PHP (`viewlogs.php`), so server-side form handling is possible
- Deployed via SFTP (use `deploy` skill) — **deploy only when explicitly asked**

## Stylesheets

| File | Scope |
|------|-------|
| `site.css` | The live shared stylesheet, linked by all six pages. Pine/ochre/cream tokens, Fraunces + Inter typography, the shared shell, and the whole component vocabulary. |
| `prototype.css` | Reference only, **`redesign` branch only** — linked by `index-prototype.html`, not by any live page. `site.css` has now adopted everything it is going to: the components in Phase 4 and the homepage layout in Phase 5. Nothing here is still pending a port; Phase 9 deletes it. |

`prototype.css` is scaffolding, not a second live stylesheet: only
`index-prototype.html` links it, and nothing links to that page. The new system lands
in `site.css` across all six pages (Phases 1–4) before any single page is
restructured; Phase 9 deletes both prototype files.

## Pages

| File | Content |
|------|---------|
| `index.html` | Editorial hero, next-service band, mission/vision, photography, heritage + milestones, address strip. Rebuilt in Phase 5. |
| `index-prototype.html` | First-draft editorial homepage, reference only — not linked, not deployed. |
| `about.html` | Tabbed: history + landmark designation; many modals |
| `services.html` | Tabbed: camp meeting / rekindling / prayer; modals |
| `events.html` | Season schedule — one card per event |
| `visit.html` | Tabbed: directions + attractions + cottages; carousel modals |
| `contact.html` | Hero + contact card |

`backup/` holds old versions — not part of the live site, **never edit it**.
`docs/` holds planning documents. `viewlogs.php` is a password-protected log
viewer, not linked from the nav.

## Color scheme

Landed in `site.css` (Phase 1). `--pine` `#2c5741` is the primary accent with
`--ochre` `#b4762a` as the second, on `--cream` / `--paper`. Bootstrap adopts the
palette through a `--bs-*` remapping in the same `:root` block, so `.text-success`
and friends recolor without touching any HTML class. Red is retired, and color must
never be the only carrier of meaning — Sunday events are pine, Saturday ochre, and
both spell the day out in text. See design direction §5 for the full token list and
the contrast-safe pairings — use the custom properties, never raw hex.

`--bs-danger-rgb` is deliberately **not** remapped. No element uses a danger class any
more, so the token keeps Bootstrap's red and means "error" again. Do not spend it on
decoration.

## Typography

Landed in `site.css` (Phase 2). Fraunces for `h1`–`h4` and `.navbar-brand`, Inter for
everything else. Body is `1.0625rem` / `1.7` — **a floor, not a target; never reduce
it for visual balance.** Headings are weight 600 at `line-height: 1.12` with fluid
`clamp()` sizes. `--measure` (66ch) caps line length for sustained reading, applied
via the `.measure` class and the `.tab-pane`, `.notice`, and `.event-body` rules. Long-form
prose is left-aligned everywhere; the prayer on `services.html` is the one
deliberate exception.

## Page head

Every page carries a unique `<title>`, a `<meta name="description">`, an Open Graph
block, and an inline-SVG favicon. Order in the `<head>` matters: Bootstrap first,
the three font links second, `site.css` last, so site rules win. Full canonical block
in `docs/redesign-plan.md` Appendix B.

## The shared shell — nav, footer, year script

Landed in `site.css` and all six pages (Phase 3). Three blocks — a sticky
`.site-nav`, a `.site-footer`, and the year script — are **identical on all six
pages, byte for byte**, with one exception: the current page's nav link carries
`class="nav-link active"` **and** `aria-current="page"`, because the ochre
underline is a color cue and must not be the only signal. On `index.html` there
is no Home link, so the brand carries `aria-current="page"` instead.

The canonical markup is `docs/redesign-plan.md` Appendix A — copy from there or
from any existing page. The nav collapses to `#site-nav-links` (renamed from
Bootstrap's example `navbarNavAltMarkup`); the footer sits immediately before the
Bootstrap script tag; the year script sits immediately after it and fills both
`.footer-year` on every page and `#current-year` on the homepage, guarding for
the latter's absence. Both years are also **hardcoded in the markup** so a
visitor without JavaScript never sees a bare `©`.

**A change to any of the three is a change to all six files.** That is the
accepted tradeoff for a no-build static site: it works without JS and never
flashes unstyled. `checks/run.sh` enforces it — `nav-identical-across-pages` and
`footer-identical-across-pages` normalize away whitespace and the active markers
and fail on any other difference.

Colors, the sticky behavior, the translucent background, and the toggler icon all
come from `site.css`. Pages carry no inline `<style>` block.

## Hero pattern

Two spellings exist, both carrying `.hero` so the contrast spec's skip list —
which cannot measure text over a photograph — reaches either.

**`index.html` — the editorial hero (`.hero .hero-feature`).** The approved
direction: the image fills the block, a gradient `.hero__scrim` darkens only the
bottom where the type sits, and the type sets flush left at the bottom.

```html
<header class="hero hero-feature">
  <img src="chapel.jpg" alt="" class="hero__img" width="1000" height="672">
  <div class="hero__scrim"></div>
  <div class="hero__body">
    <div class="container container-narrow">
      <p class="hero__eyebrow">...</p>
      <h1 class="hero__title">...</h1>
      <p class="hero__subtitle">...</p>
    </div>
  </div>
</header>
```

The hero image is decorative — the `<h1>` beside it carries the meaning — so it
takes `alt=""` and is the **one** image on the page exempt from `loading="lazy"`.

**`contact.html` — the old centered hero (`.hero`, `.hero-overlay`,
`.hero-title`, `.hero-subtitle`).** Full-bleed image under a flat overlay with
the text shadowed and vertically centered. Phase 8 moves it onto
`.hero-feature`, after which those four rules go.

```html
<div class="hero position-relative overflow-hidden d-flex align-items-center">
  <img src="chapel.jpg" alt="..." class="img-fluid position-absolute w-100 h-100"
       style="object-fit: cover; object-position: center;" />
  <div class="hero-overlay position-absolute w-100 h-100"></div>
  <div class="position-relative w-100 px-3 px-md-0">
    <div class="container">
      <div class="row">
        <div class="col-12 col-md-8 col-lg-6 ms-md-auto">
          <h1 class="hero-title display-3 fw-bold text-light">...</h1>
          <h4 class="hero-subtitle text-light mt-3">...</h4>
        </div>
      </div>
    </div>
  </div>
</div>
```

## The next-service band (index)

`.next-service` is the pine-deep strip under the homepage hero. **Its markup is
the no-JavaScript fallback and must read true on any date** — "Sunday evening
services at 6:00 pm" always is. The `data-ns="eyebrow|headline|meta"` slots are
where Phase 6's `schedule.js` will write a real date; anything that writes them
must leave the fallback alone when it has nothing better to say, including
off-season. `next-service-fallback-truthful` loads the page in a browser with
JavaScript switched off and fails if the band names a month or a year.

There is deliberately **no inline `SCHEDULE` array** — the prototype had one and
it duplicates `events.html`, which is the thing the owner rejected.

## Component vocabulary

Landed in `site.css` (Phases 4 and 5), ported from `prototype.css`. **Check this list
before inventing a component.** `.section` (page band) · `.section-paper` (the
alternating off-white band) · `.container-narrow` (1180px) · `.eyebrow` (small ochre
caps over a short rule, opens a section) · `.lede` · `.measure` · `.statement` +
`.statement__label` + `.statement__text` (what mission/vision look like instead of
filled cards) · `.figure-tile` (+ `.figure-lead` for a wide lead image, `.figure-uncropped`
for a photograph that must keep its own proportions) · `.pullquote` · `.milestones` ·
`.address-display` (an address as display type; `.address-callout` is the boxed one) ·
`.btn-pine` / `.btn-pine-outline` (the only two button styles) · `.inline-reference` ·
`.notice` · `.no-break`.

**The `ch` trap.** `--measure` is `66ch`, and `ch` resolves against each element's own
font size — so `.measure` on a `.lede` yields a column a third wider than `.measure` on
body text. `.lede.measure` is capped at `54ch` for that reason, which is the same
physical width. Any future component set larger than body copy needs the same treatment;
`measure-capped` fails at 780px and will catch it.

Headings inside a `.section` take `--pine-deep` from a single rule; the ochre in a band
is carried by the eyebrow above the heading. Every `a`, `button`, `.btn`, and
`[tabindex]` gets a 2px pine focus ring — the rule uses `:is()` so it outweighs
Bootstrap's own `.btn:focus-visible`. A cross-origin `<iframe>` cannot be reached this
way (focus moves into the frame's own document), which is why the map is exempt.

**Never reintroduce:** filled card headers (`bg-success` / `bg-danger` + white text),
`bg-gradient`, `btn-secondary`, heavy shadows, centered long-form prose, or color as
the only carrier of meaning.

## Events card pattern

Each event is a flat block — a thin colored left rule, the day and date in Fraunces,
the title as an `<h2>`, the description in Inter. No card, no header fill.

```html
<article class="event-card event-card-sunday mb-4">
  <p class="event-day">Sun &middot; <span class="no-break">Aug 2</span></p>
  <h2 class="event-title">Event Title</h2>
  <p class="event-body">Description</p>
</article>
```

`event-card-sunday` tints the rule and day pine, `event-card-saturday` ochre — but the
day is always spelled out, so stripping every color from the page loses nothing. The
`day-conveyed-in-text` spec enforces that.

## Tab pattern (about, services, visit)

Tabs use `nav-underline` with the same ochre active underline as the site nav; the
panes sit in a `.section` + `.container-narrow`, with `.tab-pane` capping the reading
column at `--measure`. Each pane opens with an `.eyebrow` above a left-aligned `<h2>`.
Phase 7 replaces the tabs with anchored sections. Note the panes still carry positive
`tabindex` values, which breaks keyboard order — Phase 7 removes them.

## Modal pattern

Inline text triggers use `class="inline-reference"` (a dotted-underline text
button styled in `site.css`) — never a `btn`. `.btn-pine-outline` is for genuine
standalone actions only: the photo-gallery openers on `visit.html` and the two
external links. Image-only modals use `modal-xl`; text modals use the default size.

## Working rules

- Never change a visitor-facing fact — dates, names, prices, phone numbers,
  addresses, emails, link destinations, historical claims — without explicit
  approval. New connective copy is fine, but flag it for review.
- Never caption a photograph with a fact you have not verified.
- Check rendered output, not just markup: serve with `python3 -m http.server`,
  screenshot at 1440 and 390, confirm zero horizontal overflow at 390px.
- Every page must work without JavaScript. JS enhances, never gates content.
