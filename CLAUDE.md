# Dimock Camp Meeting Ground — Site Notes

Static HTML site for a Methodist camp meeting ground in Dimock, PA (est. 1877).

`AGENTS.md` is a symlink to this file — edit this one.

**The founding year is 1877 — do not "fix" it to 1875.** `about.html` narrates a lot of
1875 (the grounds were leased that July; the first camp meeting-style preaching was
August 25, 1875), so 1875 looks like the founding year from that page alone. It is not.
The grounds were chartered August 15, 1877, the signage reads "Since 1877", the 150th
year is 2027, and `events.html` calls 2026 the 149th season — all of which only work
from 1877. Confirmed by the owner 2026-07-27. `about.html` is the source of truth for
the *events* of the history, not for the founding year.

**`about.html` describes the past. Do not lift its numbers into the present tense.**

| Figure in `about.html` | Actually |
|---|---|
| "about 100 cottages" | The heyday count, in a paragraph about tents and 1918. **Today it is around 30.** |
| "the 23.2-acre grounds" | The 1875 lease from Col. Olney Bailey, before the association bought the property. Still about 23 acres — confirmed by the owner 2026-07-28. |

Both went onto the homepage as present-tense claims and one was wrong. Before stating a
number about the grounds *as they are*, check whether the sentence you took it from is
describing 1875.

## Design authority

**Read `docs/design-direction.md` before any visual change** and `docs/redesign-plan.md`
before doing the work. The first carries the approved palette, typography, component
system, and accessibility standards; the second is the phased plan with checkboxes. This
file describes the code as it stands; those describe where it is going. Where they
disagree about intent, the design direction wins.

`docs/` is gitignored — local to this working copy, not in the repository. If those
documents are missing, the redesign has to be replanned; do not guess the direction from
the code alone.

## Verifying changes

```bash
checks/run.sh            # all specs, desktop + mobile; non-zero exit on any failure
checks/run.sh --shots    # same, plus screenshots into docs/screens/ for review
```

`checks/` is a Playwright harness serving the site on port 8811, asserting for every page
at 1440×900 and 390×844: no console errors, one `<h1>`, zero horizontal overflow, plus
contrast, nav/footer identity, metadata, heading order, anchored sections, schedule
self-consistency, and the image budget. Run it before every commit touching HTML or CSS.
A passing run is necessary but not sufficient — `--shots` exists to be looked at.

Four files, one job each: `contrast.mjs` (WCAG arithmetic), `specs.mjs` (**the rules —
the only file that grows**), `site-check.mjs` (runner), `run.sh` (server up, check, down).
Adding a rule means editing `specs.mjs` only. Each spec is commented and its failure
message names itself — read `specs.mjs` for the details of any rule named below.

- **`checks/` is never deployed.** `.claude/commands/deploy.md` excludes it with `backup/`.
- Playwright is not installed locally and the browser revision mismatches — **use the
  `playwright-gotchas` skill** before writing any script that drives a browser.
- `no-console-errors` exempts `maps.gstatic.com`, `maps.googleapis.com`, and
  `www.google.com` — the Maps embed on `visit.html` throws into the host console about
  one load in ten and nothing here can prevent it. Google Fonts is deliberately **not**
  exempt, so a font that fails to load fails the run.
- A spec may declare `clock` (ISO string, or a function `(page, ctx) => iso` given the
  unstubbed page) to run against a frozen `Date`. Every schedule spec uses the function
  form so no clock names a date from a particular season.

## Stack

- **Bootstrap 5.3.1** via CDN with SRI `integrity` hashes — keep them
- **Fraunces + Inter** via Google Fonts with two `preconnect` links. All three `<link>`
  tags sit between the Bootstrap stylesheet and `site.css`, identically on all six pages
- **`site.css` is the only stylesheet** — linked by all six pages, holding the tokens,
  typography, shared shell, and the whole component vocabulary. Pages carry no inline
  `<style>` block. `prototype.css` and `index-prototype.html` were scaffolding and are
  deleted — **do not recreate them.** A second stylesheet nobody deploys is a file the
  next editor will change by mistake.
- No JS framework — the Bootstrap bundle plus `schedule.js`, the site's only hand-written
  script, loaded `defer` on `index.html` and `events.html`
- **No build step.** No bundler, Sass, package manager, or CMS. Every deployed file exists
  in the repo, and pages stay hand-editable by a non-developer.
- The host runs PHP (`viewlogs.php`), so server-side form handling is possible
- Deployed via SFTP (use `deploy` skill) — **deploy only when explicitly asked**

## Pages

| File | Content |
|------|---------|
| `index.html` | Editorial hero, next-service band, mission/vision, photography, heritage + milestones, address strip. |
| `about.html` | Anchored sections: history + landmark designation; a few modals. |
| `services.html` | Anchored sections: camp meeting / rekindling / prayer; one modal. |
| `events.html` | Season schedule — one card per event; source of truth for the whole site's schedule. |
| `visit.html` | Anchored sections: directions + map, attractions, cottages for sale; carousel modals. |
| `contact.html` | Editorial hero, then one short section: the email address and a link to directions. Nothing else. |

`backup/` holds old versions — **never edit it**. `docs/` holds planning documents.
`viewlogs.php` is a password-protected log viewer, not linked from the nav.

Four owner decisions, all 2026-07-28, all enforced by specs:

- **No forms, and no PHP the site depends on.** A server-side contact form was proposed
  and declined; the contact mechanism is the `mailto:` link. `no-forms-on-site` fails on
  any `<form>` and on any `href`/`src`/`action` pointing at a `.php` file — `viewlogs.php`
  escapes only because nothing links to it. Do not re-propose the form.
- **The cottage-sale contact belongs to `visit.html` alone.** Kevin Setzer's name and
  570-396-6331 appear in Visit's cottages section and nowhere else; duplicating them onto
  contact was declined. `cottage-contact-is-visit-only` fails both ways.
- **`contact.html` is deliberately short: an email address and a link to directions.**
  Drafts also carried the postal address, the service times, and the cottage listing; the
  owner cut all three. Each already exists where it is correct, and a copy here is a
  second thing to keep true.
- **Do not put a postal address on contact**: 46 Dimock Camp Road is where the grounds
  are, not an address that receives mail. The association uses a PO box; its number is not
  in this repository. `address-present-on-key-pages` exempts contact on purpose.

## Color scheme

`--pine` `#2c5741` is the primary accent, `--ochre` `#b4762a` the second, on `--cream` /
`--paper`. Bootstrap adopts the palette through a `--bs-*` remapping in the same `:root`
block, so `.text-success` and friends recolor without touching any HTML class. Red is
retired, and **color must never be the only carrier of meaning** — Sunday events are pine,
Saturday ochre, and both spell the day out in text. Design direction §5 has the full token
list and contrast-safe pairings — use the custom properties, never raw hex.

`--bs-danger-rgb` is deliberately **not** remapped: nothing uses a danger class, so the
token keeps Bootstrap's red and means "error". Do not spend it on decoration.

## Typography

Fraunces for `h1`–`h4` and `.navbar-brand`, Inter for everything else. Body is
`1.0625rem` / `1.7` — **a floor, not a target; never reduce it for visual balance.**
Headings are weight 600 at `line-height: 1.12` with fluid `clamp()` sizes. `--measure`
(66ch) caps line length, applied via `.measure` and the `.notice` / `.event-body` rules.
Long-form prose is left-aligned everywhere; the prayer on `services.html` is the one
deliberate exception (`.measure .prayer`, centering text and column together).

## Page head

Every page carries a unique `<title>`, `<meta name="description">`, `<link rel="canonical">`,
an Open Graph block, and an inline-SVG favicon. Order matters: Bootstrap first, the three
font links second, `site.css` last, so site rules win. Full canonical block in
`docs/redesign-plan.md` Appendix B.

**The site is `dimockcampmeeting.org`.** The canonical link, `og:url`, and `og:image` are
absolute URLs on that origin — a relative `og:image` cannot be resolved by a social
scraper, which is why link previews used to render bare.
`canonical-and-og-url-absolute` enforces this and reads the origin off `index.html`, so
switching all six pages to `https://` needs no edit to `checks/`.

## HTTPS

**HTTPS is broken on `dimockcampmeeting.org`** as of 2026-07-28 — port 443 is open but the
server aborts the handshake with TLS alert 80 and never presents a certificate. Plain
`http://` works, with no redirect into the failure. This is hosting configuration at
1&1/IONOS; nothing here causes it and SFTP cannot fix it. Plan: `docs/https-fix-plan.md`.

Two consequences: **fetch the live site over `http://` when verifying a deploy** (an
`https://` failure says nothing about your change), and **the absolute URLs in page
metadata use `http://` on purpose** — a canonical pointing at a URL that does not resolve
is worse than one that does.

## The shared shell — nav, footer, year script

Three blocks — a sticky `.site-nav`, a `.site-footer`, and the year script — are
**identical on all six pages, byte for byte**, with one exception: the current page's nav
link carries `class="nav-link active"` **and** `aria-current="page"`, because the ochre
underline is a color cue and must not be the only signal. `index.html` has no Home link,
so the brand carries `aria-current="page"` instead.

Canonical markup is `docs/redesign-plan.md` Appendix A — copy from there or from any
existing page. The nav collapses to `#site-nav-links`; the footer sits immediately before
the Bootstrap script tag; the year script sits immediately after it and fills both
`.footer-year` on every page and `#current-year` on the homepage, guarding for the
latter's absence. Both years are also **hardcoded in the markup** so a visitor without
JavaScript never sees a bare `©`.

**A change to any of the three is a change to all six files** — the accepted tradeoff for
a no-build static site that works without JS and never flashes unstyled.
`nav-identical-across-pages` and `footer-identical-across-pages` enforce it.

## Hero pattern

One spelling, `.hero .hero-feature`, on the two pages with a hero: `index.html` and
`contact.html`. The `.hero` class earns its place as the key to the contrast spec's skip
list — that spec cannot measure text over a photograph. The image fills the block, a
gradient `.hero__scrim` darkens only the bottom where the type sits, and the type sets
flush left at the bottom.

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

The hero image is decorative — the `<h1>` beside it carries the meaning — so it takes
`alt=""` and is the **one** image on the page exempt from `loading="lazy"`. The `<h1>`
names the page, not the site: "Dimock Camp Meeting Ground" on the homepage, "Contact Us"
on contact, with the site name moved up to the eyebrow.

## The next-service band (index)

`.next-service` is the pine-deep strip under the homepage hero. **Its markup is the
no-JavaScript fallback and must read true on any date** — "Sunday evening services at
6:00 pm" always is. `schedule.js` writes the real next service into the
`data-ns="eyebrow|headline|meta"` slots; anything writing them must leave the fallback
alone when it has nothing better to say, including off-season.
`next-service-fallback-truthful` and `homepage-band-off-season` enforce both halves.

There is deliberately **no inline `SCHEDULE` array** — it would duplicate `events.html`,
which is the thing the owner rejected.

## Component vocabulary

**Check this list before inventing a component.** `.section` (page band) · `.section-paper`
(alternating off-white band) · `.container-narrow` (1180px) · `.eyebrow` (small ochre caps
over a short rule, opens a section) · `.lede` · `.measure` · `.statement` +
`.statement__label` + `.statement__text` (mission/vision, instead of filled cards) ·
`.figure-tile` (+ `.figure-lead` for a wide lead image, `.figure-uncropped` for a
photograph that must keep its proportions, `.figure-portrait` to stop a small scan being
blown up past its own size) · `.pullquote` · `.milestones` · `.address-display` (address as
display type; `.address-callout` is the boxed one) · `.btn-pine` / `.btn-pine-outline` (the
only two button styles) · `.inline-reference` · `.notice` · `.no-break` · `.page-contents`
(in-page contents list atop a long article) · `.prayer` (the one centered block on the site).

**The `ch` trap.** `--measure` is `66ch`, and `ch` resolves against each element's own font
size — so `.measure` on a `.lede` yields a column a third wider than on body text.
`.lede.measure` is capped at `54ch`, the same physical width. Any future component set
larger than body copy needs the same treatment; `measure-capped` will catch it.

Headings inside a `.section` take `--pine-deep` from a single rule; the ochre in a band is
carried by the eyebrow above the heading. Every `a`, `button`, `.btn`, and `[tabindex]`
gets a 2px pine focus ring — the rule uses `:is()` so it outweighs Bootstrap's own
`.btn:focus-visible`. A cross-origin `<iframe>` cannot be reached this way, which is why
the map is exempt.

**Never reintroduce:** filled card headers (`bg-success` / `bg-danger` + white text),
`bg-gradient`, `btn-secondary`, heavy shadows, centered long-form prose, or color as the
only carrier of meaning.

## Events card pattern

Each event is a flat block — a thin colored left rule, the day and date in Fraunces, the
title as an `<h2>`, the description in Inter. No card, no header fill. Three
fill-in-the-blanks and no attributes:

```html
<article class="event-card">
  <p class="event-day">Sun, Aug 2</p>
  <h2 class="event-title">Event Title</h2>
  <p class="event-body">Description</p>
</article>
```

**Do not add anything to that `<article>` tag.** `data-event-date`, `data-event-title`,
`event-card-sunday` / `event-card-saturday`, `mb-4`, and `<span class="no-break">` were all
removed — each was an invisible second copy of a fact the card already states, or a utility
class a non-developer had to know. Spacing lives on `.event-card`, the unbroken date on
`.event-day`. `season-is-self-consistent` fails if any of them comes back.

`schedule.js` applies the day tints from the date it parsed. Tint is decoration, so script
may own it; the day is spelled out in the markup, so nothing is gated. (Checked: with
`defer` the classes land before first contentful paint even throttled — no untinted flash.)

The day line is read leniently — `Sat, Jul 11`, `Saturday, July 11`, `Sat · Jul 11`, and
`Sat Jul 11` all parse; months match by case-insensitive prefix of three characters or
more. **The weekday word is not used for parsing**; it is redundant on purpose, and
`season-is-self-consistent` makes the redundancy pay by failing when word and date
disagree — the one mistake lenient parsing cannot catch. An unreadable day line degrades
rather than lies: the card stays where the author put it, untinted and unsorted, text
intact.

## The schedule — `events.html` is the source of truth

The cards on `events.html` are the only place the season is written down, and each fact
appears once, where the visitor reads it. The year is the exception — not on any card, so
it comes from `data-season="2026"` on the `.schedule` wrapper, written once for the season.
A missing or non-numeric `data-season` yields no events at all: the page is left as served
and the homepage keeps its fallback.

**Edit the cards, not the script** — descriptions carry quotation marks, `<cite>` tags, and
links, which is why they are not JavaScript string literals. The comment above the card
list is the whole of the documentation the next editor gets (`docs/` is never deployed) —
keep it accurate. `schedule.js` is thoroughly commented; read it rather than a summary
here. It enhances and gates nothing: past cards are dimmed, never hidden, and any failure
on the homepage leaves the true fallback in place.

Three traps, each already paid for: `fetch()` cannot read a `file://` page (review through
`checks/run.sh`, not by opening the file); a date built from a UTC-parsed ISO string rolls
backward in US timezones, so dates use `new Date(y, m - 1, d)` and round-trip to reject
"Feb 31"; and an event stays upcoming through the end of its own day, so tonight's service
does not vanish at midnight this morning.

**`checks/` knows no particular season.** The schedule specs read the season off
`events.html` and assert only that it agrees with itself — day lines parse, weekday words
match their dates, dates ascend, all fall in the `data-season` year, and the eyebrow's
ordinal is that year minus 1877. **Pasting in a new season must leave `checks/run.sh` green
with no edit to `checks/`** — verified against a six-card 2027 season and four deliberate
breaks, each of which a spec named.

## Anchored sections (about, services, visit)

Each page is a masthead `.section` — `<h1>`, optionally a `.lede`, and a `.page-contents`
list of in-page links — followed by one `.section` per topic, alternating with
`.section-paper`:

```html
<div class="section section-paper">
  <div class="container container-narrow">
    <div class="measure">
      <p class="eyebrow">Since 1877</p>
      <h2 id="history">Dimock's History</h2>
      <h3 id="founding">Founding and Early Organization</h3>
      ...
```

**Every `<h2>` and `<h3>` in a section carries an `id`**, because any of them may be linked
to. `:is(h1,h2,h3)[id]` gets `scroll-margin-top: 7rem` so arriving by fragment does not
park the heading under the sticky nav. The reading column comes from `.measure` on a
wrapper div — one column for the whole section, not one per child. On `visit.html` the map
sits inside that column too: at full `.container-narrow` width a 16×9 frame is 660px tall
and swallows the page.

Heading levels are `h1` → `h2` → `h3`, no skips (`heading-order-intact`, every page but
events).

**No tabs, anywhere.** `no-tabs-anywhere` fails on any `data-bs-toggle="tab"`. Content
behind a tab cannot be linked to, cannot be found with the browser's find, and does not
print — an anchored `.section` is the replacement. **No positive `tabindex` anywhere**
either: a positive value does not move one element forward, it moves every element without
one to the back of the queue for the whole page.

## Modal pattern

Inline text triggers use `class="inline-reference"` (a dotted-underline text button) —
never a `btn`. `.btn-pine-outline` is for genuine standalone actions only: the photo-gallery
openers on `visit.html` and the two external links. Image-only modals use `modal-xl`; text
modals use the default size.

**A modal is for a genuine aside, never for a photograph.** What is left is `#wyalusing`,
`#ira-walker`, and `#stock` on `about.html` and `#poster` on `services.html` — three
digressions and two documents you need to zoom in to read. `history-images-inline` fails if
one of those pictures goes back to being reachable only through a trigger.

## Images

**The budget is 450 KB an image and 4.5 MB the whole site** (`image-weight-budget`); the
site sits at about 4.05 MB, down from 5.77 MB. That is looser than the 250 KB / 2 MB the
redesign plan first asked for, and the reasons are why nobody should re-tighten it:

- `sips` is the only encoder available — no package manager, and macOS 12 cannot write WebP
  (`sips -s format webp` reports success and produces no file)
- Its quality scale runs high: quality 80 takes ~16% off these photographs, not 70%.
  Quality **65** is the working setting and the floor before artifacts show
- **Twelve images re-encode *larger*** — `chapel.jpg`, `poster.jpg`, `lewislodge.jpg`,
  `train.jpg`, `sunset.jpg`, `bears1.jpg`, and all six `kevin_cottage_*.jpg` keep their
  originals on purpose. Check the output is actually smaller before replacing anything
- **`sips -Z` upscales** — it fits the box in *both* directions, so running it over the
  folder inflates every small image. Only downscale files that exceed the target

`chapel.jpg` is 1000×672 and is upscaled by the hero on any desktop screen. There is no
higher-resolution original — confirmed by the owner 2026-07-28 — so this is accepted, not a
bug. Do not sharpen it to compensate.

`no-oversized-images` fails an image served at more than 2× its displayed width, measured
at the desktop viewport. `poster.jpg` and `stock.jpg` are exempt: they are documents, and
resolution is the point of them.

**Every `<img>` needs `alt`, `loading="lazy"`, `width`, and `height`** — the hero image is
the one exemption, being decorative (`alt=""`) and not lazy. `alt=""` is a decision that
marks an image decorative; `all-images-have-alt` fails on a missing attribute, placeholder
text, or an alt that is just the filename. Width and height must match the file — resizing
an image means updating them wherever it appears, or the page shifts as it loads.

## Working rules

- Never change a visitor-facing fact — dates, names, prices, phone numbers, addresses,
  emails, link destinations, historical claims — without explicit approval. New connective
  copy is fine, but flag it for review.
- Never caption a photograph with a fact you have not verified.
- Check rendered output, not just markup: serve with `python3 -m http.server`, screenshot at
  1440 and 390, confirm zero horizontal overflow at 390px.
- Every page must work without JavaScript. JS enhances, never gates content.
