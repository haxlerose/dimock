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

`no-console-errors` ignores errors thrown by `maps.gstatic.com`,
`maps.googleapis.com`, and `www.google.com` — the Google Maps embed on
`visit.html` throws inside its own scripts about one load in ten and reports it
into the host page's console. Nothing in this repository can prevent it. Google
Fonts is deliberately **not** exempt, so a font that fails to load still fails
the run.

A spec may declare `clock`, either as an ISO string or as a function
`(page, ctx) => iso` handed the already-loaded, unstubbed page. The runner then gives
the spec a page of its own with `Date` frozen to that moment — installed before the
document's own scripts run, which is why it cannot share the page the other specs use.
The stub leaves the multi-argument constructor alone, so `new Date(y, m - 1, d)` still
yields local midnight, which is what `schedule.js` relies on. Every schedule spec uses
the function form so that no clock names a date from a particular season.

## Stack

- **Bootstrap 5.3.1** via CDN, with SRI `integrity` hashes — keep them
- **Fraunces + Inter** via Google Fonts, with two `preconnect` links. All three
  `<link>` tags sit between the Bootstrap stylesheet and `site.css`, identically on
  all six pages
- **`site.css`** — the shared stylesheet, linked by all six pages
- No JS framework — the Bootstrap bundle plus `schedule.js`, which is the site's only
  hand-written script and is loaded `defer` on `index.html` and `events.html`
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
| `about.html` | Anchored sections: history + landmark designation; a few modals. Rebuilt in Phase 7. |
| `services.html` | Anchored sections: camp meeting / rekindling / prayer; one modal. Rebuilt in Phase 7. |
| `events.html` | Season schedule — one card per event, and the source of truth for the whole site's schedule |
| `visit.html` | Anchored sections: directions + map, attractions, cottages for sale; carousel modals. Rebuilt in Phase 8. |
| `contact.html` | Editorial hero, then one section: email, post, service times, directions, cottages. Rebuilt in Phase 8. |

`backup/` holds old versions — not part of the live site, **never edit it**.
`docs/` holds planning documents. `viewlogs.php` is a password-protected log
viewer, not linked from the nav.

**No forms, and no PHP the site depends on.** The host runs PHP, so a server-side
contact form was proposed in Phase 8 and **the owner declined it, 2026-07-28**. The
contact mechanism is the `mailto:` link. `no-forms-on-site` fails on any `<form>` and
on any `href`/`src`/`action` pointing at a `.php` file — `viewlogs.php` stays out of
that net only because nothing links to it. Do not re-propose the form.

**The cottage-sale contact belongs to `visit.html` alone.** Kevin Setzer's name and
570-396-6331 appear in Visit's cottages section and nowhere else; duplicating them onto
the contact page was declined in the same conversation. Contact links to
`visit.html#cottages` instead. `cottage-contact-is-visit-only` fails both ways — if
Visit loses the number, and if any other page gains it.

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
via the `.measure` class and the `.notice` and `.event-body` rules. Long-form
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

One spelling, `.hero .hero-feature`, on the two pages that have a hero:
`index.html` and `contact.html`. The `.hero` class earns its place by being what
the contrast spec's skip list is keyed to — that spec cannot measure text over a
photograph. Phase 8 moved contact off the old centered hero and deleted
`.hero-overlay`, `.hero-title`, `.hero-subtitle`, and the bare `.hero` sizing
rule; `.hero-feature` had already overridden all three of that rule's
declarations, so nothing moved when it went.

The approved direction: the image fills the block, a gradient `.hero__scrim`
darkens only the bottom where the type sits, and the type sets flush left at the
bottom.

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
The `<h1>` names the page, not the site: "Dimock Camp Meeting Ground" on the
homepage, "Contact Us" on contact, with the site name moved up to the eyebrow.

## The next-service band (index)

`.next-service` is the pine-deep strip under the homepage hero. **Its markup is
the no-JavaScript fallback and must read true on any date** — "Sunday evening
services at 6:00 pm" always is. `schedule.js` writes the real next service into
the `data-ns="eyebrow|headline|meta"` slots; anything that writes them must leave
the fallback alone when it has nothing better to say, including off-season.
`next-service-fallback-truthful` loads the page in a browser with JavaScript
switched off and fails if the band names a month or a year, and
`homepage-band-off-season` pins the clock to December and fails if the script
reaches for a service that has already happened.

There is deliberately **no inline `SCHEDULE` array** — the prototype had one and
it duplicates `events.html`, which is the thing the owner rejected.

## Component vocabulary

Landed in `site.css` (Phases 4 and 5), ported from `prototype.css`. **Check this list
before inventing a component.** `.section` (page band) · `.section-paper` (the
alternating off-white band) · `.container-narrow` (1180px) · `.eyebrow` (small ochre
caps over a short rule, opens a section) · `.lede` · `.measure` · `.statement` +
`.statement__label` + `.statement__text` (what mission/vision look like instead of
filled cards) · `.figure-tile` (+ `.figure-lead` for a wide lead image, `.figure-uncropped`
for a photograph that must keep its own proportions, `.figure-portrait` to stop a small
scan being blown up past its own size) · `.pullquote` · `.milestones` ·
`.address-display` (an address as display type; `.address-callout` is the boxed one) ·
`.btn-pine` / `.btn-pine-outline` (the only two button styles) · `.inline-reference` ·
`.notice` · `.no-break` · `.page-contents` (the in-page contents list at the top of a
long article) · `.prayer` (the one centered block on the site).

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
the title as an `<h2>`, the description in Inter. No card, no header fill. Three
fill-in-the-blanks and no attributes:

```html
<article class="event-card">
  <p class="event-day">Sun, Aug 2</p>
  <h2 class="event-title">Event Title</h2>
  <p class="event-body">Description</p>
</article>
```

**Do not add anything to that `<article>` tag.** Phase 6.5 removed `data-event-date`,
`data-event-title`, `event-card-sunday` / `event-card-saturday`, `mb-4`, and the
`<span class="no-break">` — every one of them was an invisible second copy of a fact
the card already states, or a utility class a non-developer had to know. The spacing
lives on `.event-card` and the unbroken date on `.event-day` in `site.css`.
`season-is-self-consistent` fails if any of them comes back.

`schedule.js` applies `event-card-sunday` / `event-card-saturday` from the date it
parsed. Tint is decoration, so script may own it; the day is spelled out in the markup,
so nothing is gated. (Checked: with `defer`, the classes land before first contentful
paint even on a throttled connection — the cards do not flash untinted.)

The day line is read leniently — `Sat, Jul 11`, `Saturday, July 11`, `Sat · Jul 11`,
and `Sat Jul 11` all parse. The month matches by case-insensitive prefix of three
characters or more. **The weekday word is not used for parsing**; it is redundant on
purpose, and `season-is-self-consistent` is what makes the redundancy pay — it fails
when the word and the date disagree, which is the one mistake lenient parsing cannot
catch. An unreadable day line degrades rather than lies: the card stays exactly where
the author put it, untinted and unsorted, with its text intact.

## The schedule — `events.html` is the source of truth

The cards on `events.html` are the only place the season is written down, and each
fact appears once, where the visitor reads it. The year is the exception — it is not
on any card, so it comes from `data-season="2026"` on the `.schedule` wrapper, written
once for the whole season. A missing or non-numeric `data-season` yields no events at
all: the page is left as served and the homepage keeps its fallback.

**Edit the cards, not the script** — descriptions carry quotation marks, `<cite>` tags,
and links, which is exactly why they are not JavaScript string literals. The comment
above the card list is the whole of the documentation the next editor gets (`docs/` is
gitignored and never deployed) — keep it accurate.

`schedule.js` (loaded `defer` on `index.html` and `events.html`, the same file on
both) does two things and gates nothing:

- On `events.html` it reads the cards inside `<div class="schedule"
  data-schedule="events" data-season="…">`, sorts them, tints them, and inserts
  `<h2 class="schedule-group">` headings — "Upcoming" and "Earlier this season".
  Each heading appears only when it has cards under it. Past cards get `.is-past`
  and are **dimmed to `--muted`, never hidden**; the first upcoming card gets
  `.is-next` and a `.event-flag` reading "Next service", because the marker must be
  words and not a tint. Once every service has passed it adds a `.schedule-note`
  above the list — *"The 2026 season has ended. Next season's schedule will be
  posted here when it is set."* — with the year from `data-season`.
- On `index.html` it fetches `events.html`, parses it with `DOMParser`, and writes
  the next service into the band. On any failure it returns without touching the
  DOM, leaving the true fallback in place.

Three traps, each already paid for: `fetch()` cannot read a `file://` page (review
through `checks/run.sh`, not by opening the file); a date built from a UTC-parsed ISO
string rolls backward in US timezones, so dates are built with `new Date(y, m - 1, d)`
and round-tripped to reject "Feb 31"; and an event stays upcoming through the end of
its own day, so tonight's service does not vanish at midnight this morning.

**`checks/` knows no particular season.** `SEASON_2026` is gone. The schedule specs
read the season off `events.html` and assert only that it agrees with itself — day
lines parse, weekday words match their dates, dates ascend, all fall in the
`data-season` year, and the eyebrow's ordinal is that year minus 1877. Stubbed clocks
are derived the same way: `spec.clock` may be a function `(page, ctx) => iso` given
the already-loaded unstubbed page, so a spec says "the day after the last service"
rather than naming a date. **Pasting in a new season must leave `checks/run.sh` green
with no edit to `checks/`** — verified against a six-card 2027 season, and against
four deliberate breaks, each of which a spec named.

## Anchored sections (about, services, visit)

Phase 7 took About and Services out of tabs; Phase 8 did the same to Visit, and no
page on the site uses tabs any more. Each page is now a masthead `.section` — `<h1>`,
optionally a `.lede`, and a `.page-contents` list of in-page links — followed by one
`.section` per topic, alternating with `.section-paper`. A section is:

```html
<div class="section section-paper">
  <div class="container container-narrow">
    <div class="measure">
      <p class="eyebrow">Since 1877</p>
      <h2 id="history">Dimock's History</h2>
      <h3 id="founding">Founding and Early Organization</h3>
      ...
```

**Every `<h2>` and `<h3>` in a section carries an `id`**, because every one of them is
something a visitor may be sent a link to. `:is(h1,h2,h3)[id]` gets
`scroll-margin-top: 7rem` so arriving by fragment does not park the heading under the
sticky nav; `sections-are-anchored` visits each fragment and measures it. The reading
column comes from `.measure` on a wrapper div — one column for the whole section, not
one per child. On `visit.html` the map sits inside that column too: at full
`.container-narrow` width a 16×9 frame is 660px tall and swallows the page.

Heading levels are `h1` → `h2` (section) → `h3` (sub-heading), no skips.
`heading-order-intact` covers every page but `events`.

The prayer on `services.html` is the one deliberate centering exception: `.measure
.prayer`, which centers the text and the column together.

## No tabs, anywhere

Phase 8 removed the last of them, and with them the `.tab-pane` and `.nav-underline`
rules from `site.css`. `no-tabs-anywhere` runs on all six pages and fails on any
`data-bs-toggle="tab"`. Content behind a tab cannot be linked to, cannot be found with
the browser's own find, and does not print — an anchored `.section` is the replacement.

**No positive `tabindex` anywhere.** A positive value does not move one element
forward, it moves every element without one to the back of the queue for the whole
page. The tab panes were the only elements that carried `tabindex` at all;
`no-positive-tabindex` still runs on all six pages.

## Modal pattern

Inline text triggers use `class="inline-reference"` (a dotted-underline text
button styled in `site.css`) — never a `btn`. `.btn-pine-outline` is for genuine
standalone actions only: the photo-gallery openers on `visit.html` and the two
external links. Image-only modals use `modal-xl`; text modals use the default size.

**A modal is for a genuine aside, never for a photograph.** Phase 7 brought the history
images onto the page, so what is left is `#wyalusing`, `#ira-walker`, and `#stock` on
`about.html` and `#poster` on `services.html` — three digressions and two documents you
need to zoom in to read. `history-images-inline` fails if one of those pictures goes
back to being reachable only through a trigger.

## Working rules

- Never change a visitor-facing fact — dates, names, prices, phone numbers,
  addresses, emails, link destinations, historical claims — without explicit
  approval. New connective copy is fine, but flag it for review.
- Never caption a photograph with a fact you have not verified.
- Check rendered output, not just markup: serve with `python3 -m http.server`,
  screenshot at 1440 and 390, confirm zero horizontal overflow at 390px.
- Every page must work without JavaScript. JS enhances, never gates content.
