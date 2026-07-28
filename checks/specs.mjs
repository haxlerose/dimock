import { contrastRatio } from "./contrast.mjs";

export const PAGES = ["index", "about", "services", "events", "visit", "contact"];
export const ALL = PAGES;

const BOOTSTRAP_GREEN = "rgb(25, 135, 84)";
const BOOTSTRAP_RED = "rgb(220, 53, 69)";
const PINE = "rgb(44, 87, 65)";
const PINE_DEEP = "rgb(31, 64, 48)";
const OCHRE_INK = "rgb(138, 86, 24)";
const MUTED = "rgb(106, 111, 100)";

// The 2026 season as events.html publishes it. Held here so a spec can assert
// the machine-readable dates against something other than the same attributes
// it is checking.
const SEASON_2026 = [
  ["2026-07-11", "Sat", "Jul 11", "All That Glitters"],
  ["2026-07-18", "Sat", "Jul 18", "The Sisterhood Music"],
  ["2026-07-25", "Sat", "Jul 25", "The Frost Duo"],
  ["2026-08-02", "Sun", "Aug 2", "Cedar Routes"],
  ["2026-08-09", "Sun", "Aug 9", "Rick Marsi"],
  ["2026-08-16", "Sun", "Aug 16", "Paul and Hannah Chesterton"],
  ["2026-08-23", "Sun", "Aug 23", "Lisa Whitaker"],
  ["2026-08-30", "Sun", "Aug 30", "Patti Yoder"],
  ["2026-09-06", "Sun", "Sep 6", "Communion Service"],
];

// Text sitting over a photograph has no computable background. The hero is the
// only such place on the site; its type is white on a dark scrim with a text
// shadow and is reviewed by eye in the --shots pass.
const CONTRAST_SKIP_SUBTREES = [".hero"];

/**
 * Runs in the browser. Returns every element that owns visible text, with its
 * colour and its effective background flattened to opaque rgb(), plus enough
 * type information to pick the right WCAG threshold.
 */
const collectTextStyles = (skipSelectors) => {
  const parse = (value) => {
    const parts = (value.match(/[\d.]+/g) || []).map(Number);
    if (parts.length < 3) return null;
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const toRgb = (c) =>
    `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;

  const describe = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = el.className && typeof el.className === "string"
      ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}`
      : "";
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  };

  const results = [];

  for (const el of document.querySelectorAll("body *")) {
    if (["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(el.tagName)) continue;
    if (skipSelectors.some((selector) => el.closest(selector))) continue;

    const ownsText = Array.from(el.childNodes).some(
      (node) => node.nodeType === 3 && node.textContent.trim().length > 0
    );
    if (!ownsText) continue;

    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || Number(style.opacity) === 0) continue;
    if (el.getClientRects().length === 0) continue;

    // Walk to the root collecting backgrounds, then composite outermost inward.
    const layers = [];
    let unknown = false;
    for (let node = el; node; node = node.parentElement) {
      const nodeStyle = getComputedStyle(node);
      if (nodeStyle.backgroundImage !== "none") { unknown = true; break; }
      const bg = parse(nodeStyle.backgroundColor);
      if (bg && bg.a > 0) layers.unshift(bg);
    }
    if (unknown) continue;

    let background = { r: 255, g: 255, b: 255, a: 1 };
    for (const layer of layers) background = over(layer, background);

    const foreground = parse(style.color);
    if (!foreground) continue;

    results.push({
      element: describe(el),
      text: el.textContent.trim().slice(0, 40),
      color: toRgb(over(foreground, background)),
      background: toRgb(background),
      fontSize: parseFloat(style.fontSize),
      fontWeight: Number(style.fontWeight) || 400,
    });
  }

  return results;
};

/**
 * Runs in the browser. Reports the events page as script has left it: the group
 * headings in document order, the dates filed under each, and which card is
 * flagged as the next service.
 */
const collectSchedule = () => {
  const root = document.querySelector('[data-schedule="events"]');
  if (!root) return { error: 'no [data-schedule="events"] wrapper on the page' };

  const dateOf = (card) => card.getAttribute("data-event-date");
  const groups = [];
  const ungrouped = [];
  let current = null;

  for (const child of Array.from(root.children)) {
    if (child.classList.contains("schedule-group")) {
      current = { heading: child.textContent.replace(/\s+/g, " ").trim(), dates: [] };
      groups.push(current);
    } else if (child.classList.contains("event-card")) {
      (current ? current.dates : ungrouped).push(dateOf(child));
    }
  }

  const cards = Array.from(root.querySelectorAll(".event-card"));
  const next = root.querySelector(".event-card.is-next");
  return {
    groups,
    ungrouped,
    order: cards.map(dateOf),
    past: cards.filter((card) => card.classList.contains("is-past")).map(dateOf),
    hidden: cards.filter((card) => card.getClientRects().length === 0).map(dateOf),
    next: next ? dateOf(next) : null,
    nextText: next ? next.textContent.replace(/\s+/g, " ").trim() : "",
    nextIsPast: next ? next.classList.contains("is-past") : false,
    flagged: cards.filter((card) => card.classList.contains("is-next")).length,
  };
};

/**
 * Loads a page in a browser with JavaScript switched off. Every claim the site
 * makes has to survive this — script sharpens the schedule, it never carries it.
 */
const withoutJavaScript = async (page, ctx, name, read) => {
  const context = await page.context().browser().newContext({
    javaScriptEnabled: false,
    viewport: { width: ctx.viewport.width, height: ctx.viewport.height },
  });
  try {
    const plain = await context.newPage();
    await plain.goto(`${ctx.BASE_URL}/${name}.html`, { waitUntil: "domcontentloaded" });
    return await read(plain);
  } finally {
    await context.close();
  }
};

const STANDING_SENTENCE = /Sunday evening services at 6:00 ?pm/i;
const A_DATE =
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b|\b\d{1,2}\/\d{1,2}\b|\b20\d{2}\b/i;

/** Scans every element for a computed colour anywhere in its box. */
const collectPalette = () => {
  const properties = [
    "color",
    "backgroundColor",
    "borderTopColor",
    "borderRightColor",
    "borderBottomColor",
    "borderLeftColor",
    "outlineColor",
    "textDecorationColor",
  ];
  const found = [];
  for (const el of document.querySelectorAll("body *")) {
    const style = getComputedStyle(el);
    for (const property of properties) {
      const value = style[property];
      if (!value || value.includes(", 0)")) continue; // fully transparent
      found.push({
        value,
        property,
        element: `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}` : ""}`,
      });
    }
  }
  return found;
};

/**
 * The nav and the footer are hand-duplicated across six files, so the only
 * thing keeping them identical is a check. Normalizing throws away whitespace
 * and the two attributes that are *meant* to differ — the active class and
 * aria-current — leaving everything else as a difference worth failing on.
 */
const normalizeShell = (markup) =>
  markup
    .replace(/\s+aria-current="page"/g, "")
    .replace(/class="([^"]*)"/g, (whole, value) => {
      const kept = value.trim().split(/\s+/).filter((name) => name !== "active");
      return `class="${kept.join(" ")}"`;
    })
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ")
    .trim();

const fetchPageSources = (page) =>
  page.evaluate(async (pages) => {
    const found = {};
    for (const name of pages) {
      found[name] = await (await fetch(`${name}.html`)).text();
    }
    return found;
  }, PAGES);

const shellIdentity = (tag, label) => async (page, ctx) => {
  const sources = await fetchPageSources(page);
  const pattern = new RegExp(`<${tag}[\\s\\S]*?</${tag}>`, "i");

  const blocks = {};
  for (const name of PAGES) {
    const match = sources[name].match(pattern);
    if (!match) return `${name}.html has no <${tag}> element`;
    blocks[name] = normalizeShell(match[0]);
  }

  const mine = blocks[ctx.name];
  const different = PAGES.filter((name) => name !== ctx.name && blocks[name] !== mine);
  if (different.length === 0) return null;

  const other = blocks[different[0]];
  let at = 0;
  while (at < mine.length && mine[at] === other[at]) at += 1;
  return `${label} differs from ${different.join(", ")}; first divergence at character ${at} — this page has "${mine.slice(at, at + 50)}", ${different[0]}.html has "${other.slice(at, at + 50)}"`;
};

const bannedColor = (banned, label) => async (page) => {
  const found = await page.evaluate(collectPalette);
  const hits = found.filter((entry) => entry.value.startsWith(banned.slice(0, -1)));
  if (hits.length === 0) return null;
  const first = hits[0];
  return `${hits.length} element(s) still render ${label}, first: ${first.element} { ${first.property}: ${first.value} }`;
};

export const specs = [
  {
    id: "no-console-errors",
    pages: ALL,
    check: async (page, ctx) =>
      ctx.consoleErrors.length === 0
        ? null
        : `${ctx.consoleErrors.length} console error(s), first: ${ctx.consoleErrors[0]}`,
  },
  {
    id: "single-h1",
    pages: ALL,
    check: async (page) => {
      const count = await page.locator("h1").count();
      return count === 1 ? null : `expected exactly 1 <h1>, found ${count}`;
    },
  },
  {
    id: "no-horizontal-overflow",
    pages: ALL,
    check: async (page) => {
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      return overflow === 0 ? null : `${overflow}px of horizontal overflow`;
    },
  },
  {
    id: "no-bootstrap-green",
    pages: ALL,
    check: bannedColor(BOOTSTRAP_GREEN, "Bootstrap success green"),
  },
  {
    id: "no-bootstrap-red",
    pages: ALL,
    check: bannedColor(BOOTSTRAP_RED, "Bootstrap danger red"),
  },
  {
    id: "brand-is-pine",
    pages: ALL,
    check: async (page) => {
      const color = await page
        .locator(".navbar-brand")
        .first()
        .evaluate((el) => getComputedStyle(el).color);
      return color === PINE ? null : `.navbar-brand is ${color}, expected ${PINE}`;
    },
  },
  {
    id: "no-filled-card-headers",
    pages: ALL,
    check: async (page, ctx) => {
      const filled = await page.evaluate(
        (accents) =>
          Array.from(document.querySelectorAll(".card-header"))
            .map((header) => ({
              text: header.textContent.trim().replace(/\s+/g, " ").slice(0, 40),
              background: getComputedStyle(header).backgroundColor,
            }))
            .filter((entry) => accents.includes(entry.background)),
        [PINE, OCHRE_INK, PINE_DEEP]
      );
      if (filled.length > 0) {
        return `${filled.length} .card-header(s) still filled with an accent, first: "${filled[0].text}" on ${filled[0].background}`;
      }
      // The computed check only sees what survives in the DOM; the class names
      // are what a future edit would copy, so they are banned in the source too.
      const source = await page.evaluate(
        async (name) => (await fetch(`${name}.html`)).text(),
        ctx.name
      );
      const banned = ["bg-success", "bg-danger"].filter((name) => source.includes(name));
      return banned.length === 0
        ? null
        : `the markup still uses ${banned.join(", ")}`;
    },
  },
  {
    id: "no-bg-gradient",
    pages: ALL,
    check: async (page, ctx) => {
      const source = await page.evaluate(
        async (name) => (await fetch(`${name}.html`)).text(),
        ctx.name
      );
      const count = (source.match(/bg-gradient/g) ?? []).length;
      return count === 0 ? null : `bg-gradient appears ${count} time(s)`;
    },
  },
  {
    id: "no-btn-secondary",
    pages: ALL,
    check: async (page, ctx) => {
      const source = await page.evaluate(
        async (name) => (await fetch(`${name}.html`)).text(),
        ctx.name
      );
      const count = (source.match(/btn-secondary/g) ?? []).length;
      return count === 0 ? null : `btn-secondary appears ${count} time(s)`;
    },
  },
  {
    id: "day-conveyed-in-text",
    pages: ["events"],
    check: async (page) => {
      // Strip every colour from the page: if the day is only carried by a tint,
      // this is where the information disappears.
      const cards = await page.evaluate(() =>
        Array.from(document.querySelectorAll(".event-card")).map((card) => ({
          text: card.textContent.replace(/\s+/g, " ").trim(),
          past: card.classList.contains("is-past"),
          dayTinted: getComputedStyle(
            card.querySelector(".event-day") ?? card
          ).color,
        }))
      );
      if (cards.length === 0) return "found no .event-card elements";
      const silent = cards.filter((card) => !/\b(Sat|Sun)\b/.test(card.text));
      if (silent.length > 0) {
        return `${silent.length} event card(s) name no day in text, first: "${silent[0].text.slice(0, 40)}"`;
      }
      // A service that has already happened drops its day tint along with the
      // rest of the card. That is a deliberate second state, not a stray colour
      // — and the day is still spelled out either way, which is the point.
      const offPalette = cards.filter((card) => {
        const wanted = card.past ? [MUTED] : [PINE, OCHRE_INK];
        return !wanted.includes(card.dayTinted);
      });
      return offPalette.length === 0
        ? null
        : `an .event-day on a ${offPalette[0].past ? "past" : "upcoming"} card is ${offPalette[0].dayTinted}, expected ${(offPalette[0].past ? [MUTED] : [PINE, OCHRE_INK]).join(" / ")}`;
    },
  },
  {
    id: "visible-focus-ring",
    pages: ALL,
    check: async (page) => {
      // Tabbing is what makes :focus-visible match — focus() alone does not.
      const seen = [];
      for (let step = 0; step < 12; step += 1) {
        await page.keyboard.press("Tab");
        const focused = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          const style = getComputedStyle(el);
          const ring = parseFloat(style.outlineWidth) || 0;
          // Tabbing to a cross-origin iframe hands focus to the frame's own
          // document, so the element matches neither :focus nor :focus-within
          // out here and no stylesheet of ours can reach it. The map is the
          // only one on the site; its focus ring is the frame's to draw.
          if (el.tagName === "IFRAME") return { skip: true };
          return {
            element: `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? `.${el.className.trim().split(/\s+/)[0]}` : ""}`,
            text: (el.textContent || "").trim().slice(0, 30),
            ring: style.outlineStyle === "none" ? 0 : ring,
            shadow: style.boxShadow,
          };
        });
        if (!focused) break;
        if (!focused.skip) seen.push(focused);
      }
      // Tabbing scrolls the page, and Bootstrap turns on smooth scrolling, so
      // put it back instantly rather than leaving a later spec to measure a
      // page that is still gliding upward.
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        window.scrollTo({ top: 0, behavior: "instant" });
      });

      if (seen.length === 0) return "nothing took keyboard focus in 12 tab presses";
      const dim = seen.filter((entry) => entry.ring < 2);
      return dim.length === 0
        ? null
        : `${dim.length} of ${seen.length} focused element(s) show an outline under 2px, first: ${dim[0].element} "${dim[0].text}" (outline ${dim[0].ring}px)`;
    },
  },
  {
    id: "respects-reduced-motion",
    pages: ALL,
    check: async (page) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      try {
        const moving = await page.evaluate(() => {
          const longest = (value) =>
            Math.max(
              0,
              ...value.split(",").map((part) => {
                const seconds = parseFloat(part);
                if (Number.isNaN(seconds)) return 0;
                return /ms\s*$/.test(part.trim()) ? seconds / 1000 : seconds;
              })
            );
          return Array.from(document.querySelectorAll("body *"))
            .map((el) => {
              const style = getComputedStyle(el);
              return {
                element: `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? `.${el.className.trim().split(/\s+/)[0]}` : ""}`,
                seconds: Math.max(
                  longest(style.transitionDuration),
                  longest(style.animationDuration)
                ),
              };
            })
            .filter((entry) => entry.seconds > 0.02);
        });
        return moving.length === 0
          ? null
          : `${moving.length} element(s) still animate under prefers-reduced-motion, first: ${moving[0].element} at ${moving[0].seconds}s`;
      } finally {
        await page.emulateMedia({ reducedMotion: null });
      }
    },
  },
  {
    id: "text-contrast-aa",
    pages: ALL,
    check: async (page) => {
      const samples = await page.evaluate(collectTextStyles, CONTRAST_SKIP_SUBTREES);
      const failures = [];
      for (const sample of samples) {
        const large =
          sample.fontSize >= 24 || (sample.fontSize >= 18.66 && sample.fontWeight >= 700);
        const threshold = large ? 3 : 4.5;
        const ratio = contrastRatio(sample.color, sample.background);
        if (ratio + 0.005 < threshold) {
          failures.push(
            `${sample.element} "${sample.text}" ${sample.color} on ${sample.background} = ${ratio.toFixed(2)}:1, needs ${threshold}:1`
          );
        }
      }
      return failures.length === 0
        ? null
        : `${failures.length} text/background pair(s) below AA, first: ${failures[0]}`;
    },
  },
  {
    id: "day-not-color-only",
    pages: ["events"],
    check: async (page) => {
      const text = await page.evaluate(
        () => document.querySelector(".notice")?.textContent ?? ""
      );
      if (!text) return "no .notice found on the events page";
      return /marked in\s+red/i.test(text)
        ? "the notice still tells readers Saturdays are identified by colour alone"
        : null;
    },
  },
  {
    id: "body-type-scale",
    pages: ALL,
    check: async (page) => {
      const body = await page.evaluate(() => {
        const style = getComputedStyle(document.body);
        return {
          family: style.fontFamily,
          size: parseFloat(style.fontSize),
          height: parseFloat(style.lineHeight) / parseFloat(style.fontSize),
        };
      });
      const problems = [];
      if (!/^["']?Inter\b/.test(body.family)) {
        problems.push(`font-family is ${body.family}, expected Inter first`);
      }
      if (body.size < 17) problems.push(`font-size is ${body.size}px, needs >= 17px`);
      if (body.height < 1.7) {
        problems.push(`line-height is ${body.height.toFixed(2)}, needs >= 1.7`);
      }
      return problems.length === 0 ? null : problems.join("; ");
    },
  },
  {
    id: "headings-are-fraunces",
    pages: ALL,
    check: async (page) => {
      const wrong = await page.evaluate(() =>
        Array.from(document.querySelectorAll("h1, h2, h3"))
          .map((el) => ({
            tag: el.tagName.toLowerCase(),
            text: el.textContent.trim().slice(0, 30),
            family: getComputedStyle(el).fontFamily,
          }))
          .filter((entry) => !/^["']?Fraunces\b/.test(entry.family))
      );
      if (wrong.length === 0) return null;
      return `${wrong.length} heading(s) are not Fraunces, first: <${wrong[0].tag}> "${wrong[0].text}" is ${wrong[0].family}`;
    },
  },
  {
    id: "unique-titles",
    pages: ALL,
    check: async (page, ctx) => {
      const titles = await page.evaluate(async (pages) => {
        const found = {};
        for (const name of pages) {
          const response = await fetch(`${name}.html`);
          const text = await response.text();
          const match = text.match(/<title>([\s\S]*?)<\/title>/i);
          found[name] = match ? match[1].trim() : "";
        }
        return found;
      }, PAGES);
      const mine = titles[ctx.name];
      if (!mine) return "no non-empty <title>";
      const clashes = PAGES.filter((name) => name !== ctx.name && titles[name] === mine);
      return clashes.length === 0
        ? null
        : `<title> "${mine}" is shared with ${clashes.join(", ")}`;
    },
  },
  {
    id: "meta-description-present",
    pages: ALL,
    check: async (page) => {
      const content = await page.evaluate(
        () => document.querySelector('meta[name="description"]')?.content ?? null
      );
      if (content === null) return "no <meta name=\"description\">";
      return content.trim().length >= 50
        ? null
        : `meta description is ${content.trim().length} characters, needs >= 50`;
    },
  },
  {
    id: "open-graph-present",
    pages: ALL,
    check: async (page) => {
      const missing = await page.evaluate(() =>
        ["og:title", "og:description", "og:image"].filter((property) => {
          const tag = document.querySelector(`meta[property="${property}"]`);
          return !tag || !tag.content.trim();
        })
      );
      return missing.length === 0 ? null : `missing or empty: ${missing.join(", ")}`;
    },
  },
  {
    id: "favicon-present",
    pages: ALL,
    check: async (page) => {
      const href = await page.evaluate(
        () => document.querySelector('link[rel~="icon"]')?.getAttribute("href") ?? null
      );
      return href ? null : "no <link rel=\"icon\">";
    },
  },
  {
    id: "prose-not-centered",
    pages: ["index", "services"],
    check: async (page, ctx) => {
      const centered = (selector) =>
        page.evaluate((sel) => {
          const nodes = Array.from(document.querySelectorAll(sel));
          if (nodes.length === 0) return null;
          return nodes.every((el) => getComputedStyle(el).textAlign === "center");
        }, selector);

      if (ctx.name === "index") {
        // Phase 5 removed the .heritage-band this used to name. The rule it was
        // enforcing is not about that one block: nothing on the homepage that
        // runs longer than a couple of lines should be centred, wherever it sits.
        const long = await page.evaluate(() =>
          Array.from(document.querySelectorAll("p"))
            .filter((el) => el.textContent.trim().length > 200)
            .filter((el) => el.getClientRects().length > 0)
            .filter((el) => getComputedStyle(el).textAlign === "center")
            .map((el) => el.textContent.trim().replace(/\s+/g, " ").slice(0, 40))
        );
        return long.length === 0
          ? null
          : `${long.length} long paragraph(s) still centred, first: "${long[0]}"`;
      }

      const prayer = await centered("#prayer-tab-pane p");
      const rekindling = await centered("#rekindling-tab-pane p");
      if (prayer === null) return "found no paragraphs in #prayer-tab-pane";
      if (rekindling === null) return "found no paragraphs in #rekindling-tab-pane";
      if (!prayer) return "the prayer should stay centred, and is not";
      return rekindling ? "the Rekindling list is still centred" : null;
    },
  },
  {
    id: "measure-capped",
    pages: ALL,
    check: async (page, ctx) => {
      if (ctx.viewport.name !== "desktop") return null;
      const wide = await page.evaluate(() =>
        Array.from(document.querySelectorAll("p"))
          .filter((el) => el.textContent.trim().length > 200)
          .filter((el) => el.getClientRects().length > 0)
          .map((el) => ({
            text: el.textContent.trim().slice(0, 40),
            width: Math.round(el.getBoundingClientRect().width),
          }))
          .filter((entry) => entry.width > 780)
      );
      if (wide.length === 0) return null;
      return `${wide.length} prose paragraph(s) wider than 780px, first: "${wide[0].text}" at ${wide[0].width}px`;
    },
  },
  {
    id: "nav-identical-across-pages",
    pages: ALL,
    check: shellIdentity("nav", "the nav"),
  },
  {
    id: "footer-identical-across-pages",
    pages: ALL,
    check: shellIdentity("footer", "the footer"),
  },
  {
    id: "aria-current-on-active-link",
    pages: ALL,
    check: async (page, ctx) => {
      const marked = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.site-nav a[aria-current="page"]')).map(
          (el) => new URL(el.getAttribute("href"), location.href).pathname
        )
      );
      if (marked.length !== 1) {
        return `${marked.length} nav link(s) carry aria-current="page", expected exactly 1`;
      }
      // "/" is the home link on the brand, and resolves to index.html.
      const slug =
        marked[0].replace(/\/$/, "").split("/").pop().replace(/\.html$/, "") || "index";
      return slug === ctx.name
        ? null
        : `aria-current="page" points at "${slug}", not "${ctx.name}"`;
    },
  },
  {
    id: "footer-present",
    pages: ALL,
    check: async (page) => {
      const footer = await page.evaluate(() => {
        const el = document.querySelector("footer");
        if (!el) return null;
        return {
          text: el.textContent.replace(/\s+/g, " "),
          mailto: el.querySelectorAll('a[href^="mailto:"]').length,
        };
      });
      if (!footer) return "no <footer> element";
      const missing = ["46 Dimock Camp Road", "6:00 pm"].filter(
        (needle) => !footer.text.includes(needle)
      );
      if (footer.mailto === 0) missing.push("a mailto: link");
      return missing.length === 0 ? null : `the footer is missing ${missing.join(", ")}`;
    },
  },
  {
    id: "footer-year-current",
    pages: ALL,
    check: async (page, ctx) => {
      const rendered = await page.evaluate(() => {
        const el = document.querySelector(".footer-year");
        return el ? el.textContent.trim() : null;
      });
      if (rendered === null) return "no .footer-year element in the footer";

      const year = String(new Date().getFullYear());
      if (rendered !== year) return `.footer-year renders "${rendered}", expected "${year}"`;

      // Without JavaScript the span is never filled, so the served markup has
      // to carry a year of its own or the footer reads as a bare ©.
      const source = await page.evaluate(
        async (name) => (await fetch(`${name}.html`)).text(),
        ctx.name
      );
      const fallback = source.match(/<span class="footer-year">([^<]*)<\/span>/);
      if (!fallback) return "no hardcoded .footer-year fallback in the served markup";
      return /^\d{4}$/.test(fallback[1].trim())
        ? null
        : `the .footer-year fallback is "${fallback[1]}", expected a four-digit year`;
    },
  },
  {
    id: "mobile-nav-toggles",
    pages: ALL,
    check: async (page, ctx) => {
      if (ctx.viewport.name !== "mobile") return null;

      const menu = page.locator("#site-nav-links");
      const toggler = page.locator(".site-nav .navbar-toggler");
      if ((await toggler.count()) === 0) return "no .navbar-toggler in the nav";
      if ((await menu.count()) === 0) return "no #site-nav-links collapse target";

      if (await menu.isVisible()) return "the menu is already open before the toggler is used";

      // Bootstrap ignores a toggle while one is still animating, so each click
      // waits for the collapse to settle rather than for the first frame in
      // which the menu happens to have a box.
      const settled = (open) =>
        page
          .locator(`#site-nav-links${open ? ".show" : ":not(.show)"}:not(.collapsing)`)
          .waitFor({ state: "attached", timeout: 3000 });

      await toggler.click();
      try {
        await settled(true);
      } catch {
        return "clicking the toggler did not open the menu";
      }
      if (!(await menu.isVisible())) return "the menu opened but is not visible";

      await toggler.click();
      try {
        await settled(false);
      } catch {
        return "clicking the toggler again did not close the menu";
      }
      return (await menu.isVisible()) ? "the menu closed but is still visible" : null;
    },
  },
  {
    id: "homepage-links-site-css",
    pages: ["index"],
    check: async (page) => {
      const local = await page.evaluate(() =>
        Array.from(document.querySelectorAll('link[rel~="stylesheet"]'))
          .map((el) => el.getAttribute("href"))
          .filter((href) => href && !/^https?:/i.test(href))
      );
      if (!local.includes("site.css")) return "the homepage does not link site.css";
      const extra = local.filter((href) => href !== "site.css");
      return extra.length === 0
        ? null
        : `the homepage also links ${extra.join(", ")}; site.css is the only local stylesheet`;
    },
  },
  {
    id: "hero-alt-is-decorative",
    pages: ["index"],
    check: async (page) => {
      const alt = await page.evaluate(() => {
        const img = document.querySelector(".hero img");
        return img ? { value: img.getAttribute("alt") } : null;
      });
      if (alt === null) return "no image inside .hero";
      if (alt.value === null) return "the hero image has no alt attribute at all";
      return alt.value.trim() === ""
        ? null
        : `the hero image is alt="${alt.value}"; the <h1> beside it carries the meaning, so the photograph is decorative and takes alt=""`;
    },
  },
  {
    id: "next-service-fallback-truthful",
    pages: ["index"],
    check: async (page, ctx) => {
      // schedule.js sharpens this band when it can. What has to hold for ever
      // is the sentence a visitor sees when that script never runs: it is the
      // only claim on the page that could silently go stale, so it is read from
      // a browser with JavaScript switched off.
      return withoutJavaScript(page, ctx, "index", async (plain) => {
        const band = plain.locator("#next-service");
        if ((await band.count()) === 0) return "no #next-service band on the homepage";

        const text = (await band.innerText()).replace(/\s+/g, " ").trim();
        if (!STANDING_SENTENCE.test(text)) {
          return `without JavaScript the band reads "${text}", expected the standing "Sunday evening services at 6:00 pm"`;
        }
        // A specific date in the fallback is a date nobody will update.
        const dated = text.match(A_DATE);
        return dated
          ? `the no-JavaScript band names "${dated[0]}" — the fallback has to read true on any date, so it must not carry one`
          : null;
      });
    },
  },
  {
    id: "images-lazy-with-dimensions",
    pages: ["index"],
    check: async (page) => {
      // The hero is the one image above the fold; lazy-loading it would delay
      // the thing the visitor came to look at.
      const incomplete = await page.evaluate(() =>
        Array.from(document.querySelectorAll("img"))
          .filter((img) => !img.closest(".hero"))
          .map((img) => ({
            src: img.getAttribute("src"),
            missing: [
              img.getAttribute("loading") === "lazy" ? null : 'loading="lazy"',
              img.getAttribute("width") ? null : "width",
              img.getAttribute("height") ? null : "height",
            ].filter(Boolean),
          }))
          .filter((entry) => entry.missing.length > 0)
      );
      return incomplete.length === 0
        ? null
        : `${incomplete.length} non-hero image(s) incomplete, first: ${incomplete[0].src} is missing ${incomplete[0].missing.join(", ")}`;
    },
  },
  {
    id: "heading-order-intact",
    pages: ["index"],
    check: async (page) => {
      const headings = await page.evaluate(() =>
        Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6"))
          .filter((el) => el.getClientRects().length > 0)
          .map((el) => ({
            level: Number(el.tagName.slice(1)),
            text: el.textContent.trim().replace(/\s+/g, " ").slice(0, 30),
          }))
      );
      if (headings.length === 0) return "the page has no headings";
      if (headings[0].level !== 1) {
        return `the first heading is <h${headings[0].level}> "${headings[0].text}", expected <h1>`;
      }
      for (let i = 1; i < headings.length; i += 1) {
        if (headings[i].level > headings[i - 1].level + 1) {
          return `<h${headings[i - 1].level}> "${headings[i - 1].text}" is followed by <h${headings[i].level}> "${headings[i].text}" — a skipped level`;
        }
      }
      return null;
    },
  },
  {
    id: "sticky-nav-clears-content",
    pages: ALL,
    check: async (page) => {
      const measured = await page.evaluate(() => {
        window.scrollTo({ top: 0, behavior: "instant" });
        const nav = document.querySelector(".site-nav");
        const heading = document.querySelector("h1");
        if (!nav) return { error: "no .site-nav element" };
        if (!heading) return { error: "no <h1> element" };
        return {
          navBottom: nav.getBoundingClientRect().bottom,
          headingTop: heading.getBoundingClientRect().top,
        };
      });
      if (measured.error) return measured.error;
      return measured.headingTop >= measured.navBottom - 1
        ? null
        : `the <h1> starts at ${Math.round(measured.headingTop)}px, beneath a nav ending at ${Math.round(measured.navBottom)}px`;
    },
  },
  {
    id: "event-cards-have-dates",
    pages: ["events"],
    check: async (page) => {
      const cards = await page.evaluate(() =>
        Array.from(document.querySelectorAll(".event-card")).map((card) => ({
          date: card.getAttribute("data-event-date"),
          title: card.getAttribute("data-event-title"),
          heading: (card.querySelector(".event-title")?.textContent ?? "")
            .replace(/\s+/g, " ")
            .trim(),
          day: (card.querySelector(".event-day")?.textContent ?? "")
            .replace(/\s+/g, " ")
            .trim(),
        }))
      );
      if (cards.length !== SEASON_2026.length) {
        return `expected ${SEASON_2026.length} event cards, found ${cards.length}`;
      }

      // The attributes are a second, machine-readable copy of a date and a name
      // the visitor already reads off the card. If the two ever drift apart the
      // invisible one silently wins, so they are checked against each other.
      const problems = [];
      for (const [date, day, label, title] of SEASON_2026) {
        const card = cards.find((entry) => entry.title === title);
        if (!card) {
          problems.push(`no card carries data-event-title="${title}"`);
          continue;
        }
        if (card.date !== date) {
          problems.push(`"${title}" is data-event-date="${card.date}", expected ${date}`);
        }
        if (card.heading !== title) {
          problems.push(
            `data-event-title="${title}" sits on a card headed "${card.heading}"`
          );
        }
        if (!card.day.includes(day) || !card.day.includes(label)) {
          problems.push(`"${title}" is dated ${date} but its card reads "${card.day}"`);
        }
      }
      return problems.length === 0
        ? null
        : `${problems.length} problem(s), first: ${problems[0]}`;
    },
  },
  {
    id: "events-split-at-stubbed-date",
    pages: ["events"],
    clock: "2026-08-09T18:00:00",
    check: async (page) => {
      const schedule = await page.evaluate(collectSchedule);
      if (schedule.error) return schedule.error;

      const headings = schedule.groups.map((group) => group.heading);
      if (headings.join(" | ") !== "Upcoming | Earlier this season") {
        return `group headings are "${headings.join(" | ")}", expected "Upcoming | Earlier this season" in that order`;
      }
      if (schedule.ungrouped.length > 0) {
        return `${schedule.ungrouped.length} card(s) sit above every heading, first ${schedule.ungrouped[0]}`;
      }

      const expected = {
        Upcoming: ["2026-08-09", "2026-08-16", "2026-08-23", "2026-08-30", "2026-09-06"],
        "Earlier this season": ["2026-07-11", "2026-07-18", "2026-07-25", "2026-08-02"],
      };
      for (const group of schedule.groups) {
        const want = expected[group.heading].join(", ");
        const got = group.dates.join(", ");
        if (want !== got) return `"${group.heading}" holds ${got}, expected ${want}`;
      }

      // Dimmed, never gone: someone looking for a speaker they heard in July
      // still has to be able to find them.
      if (schedule.hidden.length > 0) {
        return `${schedule.hidden.length} event card(s) are not rendered at all, first ${schedule.hidden[0]}`;
      }
      if (schedule.past.join(", ") !== expected["Earlier this season"].join(", ")) {
        return `.is-past is on ${schedule.past.join(", ")}, expected the four that have passed`;
      }
      if (schedule.flagged !== 1) {
        return `${schedule.flagged} card(s) carry .is-next, expected exactly 1`;
      }
      if (schedule.next !== "2026-08-09") {
        return `.is-next is on ${schedule.next}, expected 2026-08-09`;
      }
      return /next service/i.test(schedule.nextText)
        ? null
        : `the next service is marked only by styling — its card reads "${schedule.nextText.slice(0, 60)}" and never says so in text`;
    },
  },
  {
    id: "event-upcoming-until-end-of-day",
    pages: ["events"],
    // Eleven at night on the day of a service. It has not happened yet as far
    // as the page is concerned, and it must not slide into the past because the
    // clock has moved past midnight this morning.
    clock: "2026-08-09T23:00:00",
    check: async (page) => {
      const schedule = await page.evaluate(collectSchedule);
      if (schedule.error) return schedule.error;
      if (schedule.next !== "2026-08-09") {
        return `at 11pm on 2026-08-09 the next service is ${schedule.next}, expected that evening's own service`;
      }
      return schedule.past.includes("2026-08-09")
        ? "the evening's own service is already filed under Earlier this season at 11pm"
        : null;
    },
  },
  {
    id: "events-preseason-has-no-past-group",
    pages: ["events"],
    clock: "2026-07-01T12:00:00",
    check: async (page) => {
      const schedule = await page.evaluate(collectSchedule);
      if (schedule.error) return schedule.error;
      const headings = schedule.groups.map((group) => group.heading);
      if (headings.includes("Earlier this season")) {
        return "nothing has happened yet, and the page still offers an Earlier this season heading";
      }
      if (schedule.past.length > 0) {
        return `${schedule.past.length} card(s) are dimmed before the season has started`;
      }
      return schedule.next === "2026-07-11"
        ? null
        : `.is-next is on ${schedule.next}, expected the opening service 2026-07-11`;
    },
  },
  {
    id: "events-postseason-has-no-upcoming-group",
    pages: ["events"],
    clock: "2026-12-01T12:00:00",
    check: async (page) => {
      const schedule = await page.evaluate(collectSchedule);
      if (schedule.error) return schedule.error;
      const headings = schedule.groups.map((group) => group.heading);
      if (headings.includes("Upcoming")) {
        return "the season is over, and the page still offers an Upcoming heading";
      }
      if (!headings.includes("Earlier this season")) {
        return `expected an Earlier this season heading, found "${headings.join(" | ")}"`;
      }
      if (schedule.past.length !== SEASON_2026.length) {
        return `${schedule.past.length} of ${SEASON_2026.length} card(s) are marked past after the season has ended`;
      }
      return schedule.flagged === 0
        ? null
        : "a service is still flagged as next after the season has ended";
    },
  },
  {
    id: "homepage-band-names-next-service",
    pages: ["index"],
    clock: "2026-08-09T18:00:00",
    check: async (page) => {
      const text = (await page.locator("#next-service").innerText())
        .replace(/\s+/g, " ")
        .trim();
      const missing = ["Sunday, August 9", "Rick Marsi"].filter(
        (needle) => !text.includes(needle)
      );
      return missing.length === 0
        ? null
        : `the band reads "${text}" and never names ${missing.join(" or ")}`;
    },
  },
  {
    id: "homepage-band-off-season",
    pages: ["index"],
    clock: "2026-12-01T12:00:00",
    check: async (page) => {
      const text = (await page.locator("#next-service").innerText())
        .replace(/\s+/g, " ")
        .trim();
      // With nothing left to announce the band has to fall silent rather than
      // reach for the last event of a season that finished in September.
      if (!STANDING_SENTENCE.test(text)) {
        return `off season the band reads "${text}", expected it to fall back to the standing "Sunday evening services at 6:00 pm"`;
      }
      const dated = text.match(A_DATE);
      return dated
        ? `off season the band still names "${dated[0]}"`
        : null;
    },
  },
  {
    id: "schedule-works-without-js",
    pages: ["index", "events"],
    check: async (page, ctx) =>
      withoutJavaScript(page, ctx, ctx.name, async (plain) => {
        if (ctx.name === "index") {
          const text = (await plain.locator("#next-service").innerText())
            .replace(/\s+/g, " ")
            .trim();
          return STANDING_SENTENCE.test(text)
            ? null
            : `without JavaScript the homepage band reads "${text}"`;
        }

        const cards = await plain.evaluate(() =>
          Array.from(document.querySelectorAll(".event-card")).map((card) => ({
            date: card.getAttribute("data-event-date"),
            visible: card.getClientRects().length > 0,
            grouped: card.classList.contains("is-past") || card.classList.contains("is-next"),
          }))
        );
        if (cards.length !== SEASON_2026.length) {
          return `without JavaScript the page shows ${cards.length} of ${SEASON_2026.length} events`;
        }
        const invisible = cards.filter((card) => !card.visible);
        if (invisible.length > 0) {
          return `${invisible.length} event(s) are not rendered without JavaScript, first ${invisible[0].date}`;
        }
        const marked = cards.filter((card) => card.grouped);
        if (marked.length > 0) {
          return `${marked.length} card(s) are pre-marked past or next in the served markup — the split is the script's job`;
        }
        const order = cards.map((card) => card.date).join(", ");
        const documentOrder = SEASON_2026.map(([date]) => date).join(", ");
        return order === documentOrder
          ? null
          : `without JavaScript the events read ${order}, expected document order ${documentOrder}`;
      }),
  },
];
