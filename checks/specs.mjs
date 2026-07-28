import { contrastRatio } from "./contrast.mjs";

export const PAGES = ["index", "about", "services", "events", "visit", "contact"];
export const ALL = PAGES;

const BOOTSTRAP_GREEN = "rgb(25, 135, 84)";
const BOOTSTRAP_RED = "rgb(220, 53, 69)";
const PINE = "rgb(44, 87, 65)";
const PINE_DEEP = "rgb(31, 64, 48)";
const OCHRE_INK = "rgb(138, 86, 24)";
const MUTED = "rgb(106, 111, 100)";

// The season is written down once, in events.html, and these checks refuse to
// keep a second copy of it. Nothing below names a date, a performer, or a card
// count: the specs read the season off the page and assert that it agrees with
// itself. Paste in a different year and they stay true without an edit here.
//
// The founding year is the one constant, because the ordinal in the eyebrow is
// derived from it and nothing on the page can check it.
const FOUNDED = 1877;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

const prefixIndex = (names, word) => {
  const wanted = word.toLowerCase();
  return names.findIndex((name) => name.toLowerCase().startsWith(wanted));
};

/**
 * Reads a card's visible day line the way schedule.js does — an optional
 * weekday word, a month matched by a three-character-or-longer prefix, and a
 * day number — and returns what it found alongside the date it means. The
 * weekday word is redundant by design; keeping it here is what lets a spec fail
 * when the word and the date disagree.
 */
const parseDayLine = (text, year) => {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  const match = /^(?:([A-Za-z]{2,9})\.?[,·\s]+)?([A-Za-z]{3,9})\.?[,·\s]+(\d{1,2})\b/.exec(
    normalized
  );
  if (!match) return { error: `cannot read a month and a day out of "${normalized}"` };

  const [, weekdayWord, monthWord, dayText] = match;
  const month = prefixIndex(MONTHS, monthWord);
  if (month < 0) return { error: `"${monthWord}" is not a month name` };

  const day = Number(dayText);
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return { error: `${monthWord} ${day} is not a real date in ${year}` };
  }

  let weekday = null;
  if (weekdayWord) {
    if (weekdayWord.length < 3) return { error: `"${weekdayWord}" is too short to read` };
    weekday = prefixIndex(WEEKDAYS, weekdayWord);
    if (weekday < 0) return { error: `"${weekdayWord}" is not a weekday name` };
  }
  return { date, weekday, weekdayWord: weekdayWord ?? null };
};

const isoOf = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

const clockOn = (date, time) => `${isoOf(date)}T${time}`;

const shiftedBy = (date, days) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/**
 * Fetches events.html and reports what the *served* markup says, whatever
 * schedule.js has since done to the live DOM. Every schedule spec starts here,
 * including the ones running on the homepage, so "the season" always means the
 * one file that holds it.
 */
const readSeason = async (page) => {
  const raw = await page.evaluate(async () => {
    const response = await fetch("events.html");
    if (!response.ok) return { error: `events.html responded ${response.status}` };
    const markup = await response.text();
    const doc = new DOMParser().parseFromString(markup, "text/html");
    const wrapper = doc.querySelector('[data-schedule="events"]');
    const eyebrow = doc.querySelector(".eyebrow");
    return {
      markup,
      season: wrapper ? wrapper.getAttribute("data-season") : null,
      hasWrapper: Boolean(wrapper),
      eyebrow: eyebrow ? eyebrow.textContent.replace(/\s+/g, " ").trim() : null,
      cards: Array.from(doc.querySelectorAll(".event-card")).map((card) => ({
        day: (card.querySelector(".event-day")?.textContent ?? "")
          .replace(/\s+/g, " ")
          .trim(),
        title: (card.querySelector(".event-title")?.textContent ?? "")
          .replace(/\s+/g, " ")
          .trim(),
        classes: (card.getAttribute("class") ?? "").trim(),
        legacyDate: card.getAttribute("data-event-date"),
        legacyTitle: card.getAttribute("data-event-title"),
      })),
    };
  });

  if (raw.error) return raw;
  if (!raw.hasWrapper) return { error: 'events.html has no [data-schedule="events"] wrapper' };
  if (!/^\d{4}$/.test(String(raw.season ?? "").trim())) {
    return { error: `the schedule wrapper is data-season="${raw.season}", expected a four-digit year` };
  }
  if (raw.cards.length === 0) return { error: "events.html holds no .event-card elements" };

  const year = Number(raw.season);
  const events = raw.cards.map((card) => ({ ...card, ...parseDayLine(card.day, year) }));
  return { ...raw, year, events };
};

/** The middle service — the useful "mid-season" moment, named by position. */
const middleOf = (events) => events[Math.floor((events.length - 1) / 2)];

const seasonClock = (pick, time) => async (page) => {
  const season = await readSeason(page);
  if (season.error) throw new Error(season.error);
  const readable = season.events.filter((event) => event.date);
  if (readable.length === 0) throw new Error("no event card carries a readable date");
  const picked = pick(readable, season);
  return clockOn(picked instanceof Date ? picked : picked.date, time);
};

// Text sitting over a photograph has no computable background. The hero is the
// only such place on the site; its type is white on a dark scrim with a text
// shadow and is reviewed by eye in the --shots pass.
/**
 * The photographs that were locked inside modals before Phase 7, and the page
 * whose text each one illustrates. A modal copy may still exist for a document
 * you have to read close up — the stock certificate and the 1936 poster — but
 * the picture itself has to be on the page, where someone scrolling will see it.
 */
/* The grounds' one address, and the one place the cottage sale is contactable.
   Both are facts the owner owns; the checks only assert where they appear. */
const ADDRESS_STREET = "46 Dimock Camp Road";
const ADDRESS_TOWN = /Springville,\s*PA\s*18844/i;
const COTTAGE_PHONE = /570-396-6331/;
const COTTAGE_SELLER = /Kevin Setzer/i;

/* Text of the page with the footer taken out, so "does this page say it" cannot
   be answered by the footer every page already carries. */
const splitFooter = () => {
  const clean = (node) => (node?.textContent ?? "").replace(/\s+/g, " ").trim();
  const clone = document.body.cloneNode(true);
  clone.querySelectorAll(".site-footer").forEach((el) => el.remove());
  return { body: clean(clone), footer: clean(document.querySelector(".site-footer")) };
};

const HISTORY_IMAGES = {
  about: ["walker.jpg", "train.jpg", "stock.jpg", "meeting.jpg", "taylor.jpg", "towner.jpg", "pinchot.jpg"],
  services: ["poster.jpg", "meeting.jpg"],
};

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
 * headings in document order, the services filed under each, and which card is
 * flagged as the next one. Cards are named by their own heading, because that
 * is the only identifier left on them once the data attributes are gone — and
 * it is the one a failure message can be read aloud from.
 */
const collectSchedule = () => {
  const root = document.querySelector('[data-schedule="events"]');
  if (!root) return { error: 'no [data-schedule="events"] wrapper on the page' };

  const nameOf = (card) =>
    (card.querySelector(".event-title")?.textContent ?? "").replace(/\s+/g, " ").trim();
  const groups = [];
  const ungrouped = [];
  let current = null;

  for (const child of Array.from(root.children)) {
    if (child.classList.contains("schedule-group")) {
      current = { heading: child.textContent.replace(/\s+/g, " ").trim(), titles: [] };
      groups.push(current);
    } else if (child.classList.contains("event-card")) {
      (current ? current.titles : ungrouped).push(nameOf(child));
    }
  }

  const cards = Array.from(root.querySelectorAll(".event-card"));
  const next = root.querySelector(".event-card.is-next");
  const note = root.querySelector(".schedule-note");
  return {
    groups,
    ungrouped,
    order: cards.map(nameOf),
    past: cards.filter((card) => card.classList.contains("is-past")).map(nameOf),
    hidden: cards.filter((card) => card.getClientRects().length === 0).map(nameOf),
    next: next ? nameOf(next) : null,
    nextText: next ? next.textContent.replace(/\s+/g, " ").trim() : "",
    flagged: cards.filter((card) => card.classList.contains("is-next")).length,
    note: note ? note.textContent.replace(/\s+/g, " ").trim() : null,
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
      // this is where the information disappears. "Sat" and "Saturday" both
      // count — the day line is the owner's to write either way.
      const cards = await page.evaluate(() =>
        Array.from(document.querySelectorAll(".event-card")).map((card) => ({
          day: (card.querySelector(".event-day")?.textContent ?? "")
            .replace(/\s+/g, " ")
            .trim(),
          title: (card.querySelector(".event-title")?.textContent ?? "")
            .replace(/\s+/g, " ")
            .trim(),
          past: card.classList.contains("is-past"),
          dayTinted: getComputedStyle(card.querySelector(".event-day") ?? card).color,
        }))
      );
      if (cards.length === 0) return "found no .event-card elements";
      const silent = cards.filter((card) => !/^\s*(Sat|Sun)/i.test(card.day));
      if (silent.length > 0) {
        return `${silent.length} event card(s) name no day in text, first: "${silent[0].title}" reads "${silent[0].day}"`;
      }
      // A service that has already happened drops its day tint along with the
      // rest of the card. That is a deliberate second state, not a stray colour
      // — and the day is still spelled out either way, which is the point.
      for (const card of cards) {
        const sunday = /^\s*Sun/i.test(card.day);
        const wanted = card.past ? [MUTED] : sunday ? [PINE] : [OCHRE_INK];
        if (!wanted.includes(card.dayTinted)) {
          return `the .event-day on "${card.title}" is ${card.dayTinted}, expected ${wanted.join(" / ")}`;
        }
      }
      return null;
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

      // Phase 7 replaced the tab panes with anchored sections, so these are
      // found through the heading the visitor can actually link to rather than
      // through a pane id. The Rekindling content is a list now, not paragraphs.
      const inSectionOf = (id, childSelector) =>
        page.evaluate(
          ([anchor, sel]) => {
            const section = document.getElementById(anchor)?.closest(".section");
            if (!section) return null;
            const nodes = Array.from(section.querySelectorAll(sel));
            if (nodes.length === 0) return null;
            return nodes.every((el) => getComputedStyle(el).textAlign === "center");
          },
          [id, childSelector]
        );

      const prayer = await inSectionOf("prayer", "p");
      const rekindling = await inSectionOf("rekindling", "li");
      if (prayer === null) return "found no prayer text under #prayer";
      if (rekindling === null) return "found no list items under #rekindling";
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
    pages: ["index", "about", "services", "visit", "contact"],
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
    id: "season-is-self-consistent",
    pages: ["events"],
    check: async (page) => {
      const season = await readSeason(page);
      if (season.error) return season.error;

      // Every fact appears once, where the visitor reads it. An attribute or a
      // hand-written tint class is a second copy nobody proofreads, and when the
      // two disagree the invisible one wins and the page silently lies.
      const hidden = season.cards.filter(
        (card) =>
          card.legacyDate !== null ||
          card.legacyTitle !== null ||
          /\bevent-card-(sunday|saturday)\b/.test(card.classes)
      );
      if (hidden.length > 0) {
        const card = hidden[0];
        const copy =
          card.legacyDate !== null
            ? `data-event-date="${card.legacyDate}"`
            : card.legacyTitle !== null
              ? `data-event-title="${card.legacyTitle}"`
              : `a hand-written ${/sunday/.test(card.classes) ? "event-card-sunday" : "event-card-saturday"} class`;
        return `${hidden.length} card(s) keep an invisible second copy of a fact, first: "${card.title}" carries ${copy}`;
      }

      const problems = [];
      let previous = null;
      for (const event of season.events) {
        const name = event.title || "(untitled card)";
        if (event.error) {
          problems.push(`"${name}": ${event.error}`);
          continue;
        }
        if (!event.title) problems.push(`the card dated ${isoOf(event.date)} has no title`);
        if (event.weekday !== null && event.weekday !== event.date.getDay()) {
          problems.push(
            `"${name}" reads "${event.day}", but ${isoOf(event.date)} is a ${WEEKDAYS[event.date.getDay()]}`
          );
        }
        if (previous && event.date.getTime() <= previous.date.getTime()) {
          problems.push(
            `"${name}" (${isoOf(event.date)}) does not come after "${previous.title}" (${isoOf(previous.date)}) — cards run in date order`
          );
        }
        previous = event;
      }
      return problems.length === 0
        ? null
        : `${problems.length} problem(s) in the season, first: ${problems[0]}`;
    },
  },
  {
    id: "season-ordinal-matches-year",
    pages: ["events"],
    check: async (page) => {
      const season = await readSeason(page);
      if (season.error) return season.error;
      if (season.eyebrow === null) return "no .eyebrow above the schedule";

      const match = /(\d{4})\s+Schedule,\s*(\d+)(st|nd|rd|th)\s+Season/i.exec(season.eyebrow);
      if (!match) {
        return `the eyebrow reads "${season.eyebrow}", expected the form "${season.year} Schedule, ${season.year - FOUNDED}th Season"`;
      }
      const [, year, ordinal, suffix] = match;
      if (Number(year) !== season.year) {
        return `the eyebrow says ${year} and the schedule is data-season="${season.year}"`;
      }
      const expected = season.year - FOUNDED;
      if (Number(ordinal) !== expected) {
        return `the eyebrow calls this the ${ordinal}${suffix} season; ${season.year} minus ${FOUNDED} is ${expected}`;
      }
      const wanted =
        expected % 100 >= 11 && expected % 100 <= 13
          ? "th"
          : ["th", "st", "nd", "rd"][expected % 10] ?? "th";
      return suffix.toLowerCase() === wanted
        ? null
        : `the eyebrow reads "${ordinal}${suffix}", expected "${expected}${wanted}"`;
    },
  },
  {
    id: "events-split-at-stubbed-date",
    pages: ["events"],
    clock: seasonClock(middleOf, "18:00:00"),
    check: async (page) => {
      const season = await readSeason(page);
      if (season.error) return season.error;
      const schedule = await page.evaluate(collectSchedule);
      if (schedule.error) return schedule.error;

      const readable = season.events.filter((event) => event.date);
      const middle = middleOf(readable);
      const at = readable.indexOf(middle);
      const expected = {
        Upcoming: readable.slice(at).map((event) => event.title),
        "Earlier this season": readable.slice(0, at).map((event) => event.title),
      };

      const headings = schedule.groups.map((group) => group.heading);
      if (headings.join(" | ") !== "Upcoming | Earlier this season") {
        return `group headings are "${headings.join(" | ")}", expected "Upcoming | Earlier this season" in that order`;
      }
      if (schedule.ungrouped.length > 0) {
        return `${schedule.ungrouped.length} card(s) sit above every heading, first "${schedule.ungrouped[0]}"`;
      }
      for (const group of schedule.groups) {
        const want = expected[group.heading].join(", ");
        const got = group.titles.join(", ");
        if (want !== got) return `"${group.heading}" holds ${got}, expected ${want}`;
      }

      // Dimmed, never gone: someone looking for a speaker they heard in July
      // still has to be able to find them.
      if (schedule.hidden.length > 0) {
        return `${schedule.hidden.length} event card(s) are not rendered at all, first "${schedule.hidden[0]}"`;
      }
      if (schedule.past.join(", ") !== expected["Earlier this season"].join(", ")) {
        return `.is-past is on ${schedule.past.join(", ")}, expected ${expected["Earlier this season"].join(", ")}`;
      }
      if (schedule.flagged !== 1) {
        return `${schedule.flagged} card(s) carry .is-next, expected exactly 1`;
      }
      if (schedule.next !== middle.title) {
        return `.is-next is on "${schedule.next}", expected "${middle.title}"`;
      }
      if (schedule.note !== null) {
        return `mid-season, the page already says "${schedule.note}"`;
      }
      return /next service/i.test(schedule.nextText)
        ? null
        : `the next service is marked only by styling — its card reads "${schedule.nextText.slice(0, 60)}" and never says so in text`;
    },
  },
  {
    id: "event-upcoming-until-end-of-day",
    pages: ["events"],
    // Eleven at night on the day of the last service of the season. It has not
    // happened yet as far as the page is concerned, and it must not slide into
    // the past because the clock has moved past midnight this morning.
    clock: seasonClock((events) => events[events.length - 1], "23:00:00"),
    check: async (page) => {
      const season = await readSeason(page);
      if (season.error) return season.error;
      const last = season.events.filter((event) => event.date).slice(-1)[0];

      const schedule = await page.evaluate(collectSchedule);
      if (schedule.error) return schedule.error;
      if (schedule.next !== last.title) {
        return `at 11pm on ${isoOf(last.date)} the next service is "${schedule.next}", expected that evening's own service "${last.title}"`;
      }
      return schedule.past.includes(last.title)
        ? "the evening's own service is already filed under Earlier this season at 11pm"
        : null;
    },
  },
  {
    id: "events-preseason-has-no-past-group",
    pages: ["events"],
    clock: seasonClock((events) => shiftedBy(events[0].date, -1), "12:00:00"),
    check: async (page) => {
      const season = await readSeason(page);
      if (season.error) return season.error;
      const first = season.events.filter((event) => event.date)[0];

      const schedule = await page.evaluate(collectSchedule);
      if (schedule.error) return schedule.error;
      const headings = schedule.groups.map((group) => group.heading);
      if (headings.includes("Earlier this season")) {
        return "nothing has happened yet, and the page still offers an Earlier this season heading";
      }
      if (schedule.past.length > 0) {
        return `${schedule.past.length} card(s) are dimmed before the season has started`;
      }
      if (schedule.note !== null) {
        return `before the season has started, the page says "${schedule.note}"`;
      }
      return schedule.next === first.title
        ? null
        : `.is-next is on "${schedule.next}", expected the opening service "${first.title}"`;
    },
  },
  {
    id: "events-postseason-has-no-upcoming-group",
    pages: ["events"],
    clock: seasonClock((events) => shiftedBy(events[events.length - 1].date, 1), "12:00:00"),
    check: async (page) => {
      const season = await readSeason(page);
      if (season.error) return season.error;

      const schedule = await page.evaluate(collectSchedule);
      if (schedule.error) return schedule.error;
      const headings = schedule.groups.map((group) => group.heading);
      if (headings.includes("Upcoming")) {
        return "the season is over, and the page still offers an Upcoming heading";
      }
      if (!headings.includes("Earlier this season")) {
        return `expected an Earlier this season heading, found "${headings.join(" | ")}"`;
      }
      const readable = season.events.filter((event) => event.date).length;
      if (schedule.past.length !== readable) {
        return `${schedule.past.length} of ${readable} card(s) are marked past after the season has ended`;
      }
      return schedule.flagged === 0
        ? null
        : "a service is still flagged as next after the season has ended";
    },
  },
  {
    id: "off-season-line-appears",
    pages: ["events"],
    clock: seasonClock((events) => shiftedBy(events[events.length - 1].date, 1), "12:00:00"),
    check: async (page) => {
      const season = await readSeason(page);
      if (season.error) return season.error;

      const schedule = await page.evaluate(collectSchedule);
      if (schedule.error) return schedule.error;
      if (schedule.note === null) {
        // A static file cannot say "that was the last one" on its own, and nine
        // past services with no framing is the page implying a service is coming.
        return "every service has passed and nothing on the page says the season has ended";
      }
      return schedule.note.includes(String(season.year))
        ? null
        : `the off-season line reads "${schedule.note}" and never names the ${season.year} season`;
    },
  },
  {
    id: "homepage-band-names-next-service",
    pages: ["index"],
    // The clock is read out of events.html, fetched from inside the loaded
    // homepage — the same journey schedule.js makes.
    clock: seasonClock(middleOf, "18:00:00"),
    check: async (page) => {
      const season = await readSeason(page);
      if (season.error) return season.error;
      const middle = middleOf(season.events.filter((event) => event.date));
      const spoken = `${WEEKDAYS[middle.date.getDay()]}, ${MONTHS[middle.date.getMonth()]} ${middle.date.getDate()}`;

      const text = (await page.locator("#next-service").innerText())
        .replace(/\s+/g, " ")
        .trim();
      const missing = [spoken, middle.title].filter((needle) => !text.includes(needle));
      return missing.length === 0
        ? null
        : `the band reads "${text}" and never names ${missing.join(" or ")}`;
    },
  },
  {
    id: "homepage-band-off-season",
    pages: ["index"],
    clock: seasonClock((events) => shiftedBy(events[events.length - 1].date, 1), "12:00:00"),
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

        // The point is that nothing is gated: whatever the file holds is on
        // screen, in the order it was written, each service still naming its
        // own day. How many there are is the owner's business, not a check's.
        const cards = await plain.evaluate(() =>
          Array.from(document.querySelectorAll(".event-card")).map((card) => ({
            title: (card.querySelector(".event-title")?.textContent ?? "")
              .replace(/\s+/g, " ")
              .trim(),
            day: (card.querySelector(".event-day")?.textContent ?? "")
              .replace(/\s+/g, " ")
              .trim(),
            visible: card.getClientRects().length > 0,
            grouped: card.classList.contains("is-past") || card.classList.contains("is-next"),
          }))
        );
        if (cards.length === 0) return "without JavaScript the page shows no events at all";

        const invisible = cards.filter((card) => !card.visible);
        if (invisible.length > 0) {
          return `${invisible.length} event(s) are not rendered without JavaScript, first "${invisible[0].title}"`;
        }
        const marked = cards.filter((card) => card.grouped);
        if (marked.length > 0) {
          return `${marked.length} card(s) are pre-marked past or next in the served markup — the split is the script's job`;
        }
        const dayless = cards.filter((card) => !/\b(Sat|Sun)/i.test(card.day));
        if (dayless.length > 0) {
          return `"${dayless[0].title}" reads "${dayless[0].day}" and never names its day`;
        }

        // Read the served markup from the ordinary page: the no-JavaScript
        // context is here to render, not to run a fetch of its own.
        const season = await readSeason(page);
        if (season.error) return season.error;
        const served = season.events.map((event) => event.title).join(", ");
        const rendered = cards.map((card) => card.title).join(", ");
        return served === rendered
          ? null
          : `without JavaScript the events read ${rendered}, expected the served order ${served}`;
      }),
  },
  {
    // Phase 8 took the last page out of tabs, so this widened from about and
    // services to the whole site. Nothing on the site is behind a tab now, and
    // nothing should go back behind one.
    id: "no-tabs-anywhere",
    pages: ALL,
    check: async (page) => {
      const found = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[data-bs-toggle="tab"]')).map((el) =>
          (el.textContent ?? "").replace(/\s+/g, " ").trim()
        )
      );
      return found.length === 0
        ? null
        : `${found.length} tab trigger(s) remain, first: "${found[0]}"`;
    },
  },
  {
    id: "sections-are-anchored",
    pages: ["about", "services", "visit"],
    check: async (page) => {
      const headings = await page.evaluate(() =>
        Array.from(document.querySelectorAll(".section h2")).map((el) => ({
          id: el.id,
          text: el.textContent.replace(/\s+/g, " ").trim().slice(0, 40),
        }))
      );
      if (headings.length === 0) return "the page has no section headings";
      const unnamed = headings.filter((heading) => !heading.id);
      if (unnamed.length > 0) {
        return `${unnamed.length} section heading(s) have no id, first: "${unnamed[0].text}"`;
      }

      // An id is only half of it. Arriving by fragment has to leave the heading
      // where it can be read — the sticky nav sits over the top of the page and
      // will happily cover the very thing the link promised.
      const covered = [];
      for (const heading of headings) {
        const measured = await page.evaluate((id) => {
          location.hash = `#${id}`;
          const nav = document.querySelector(".site-nav");
          const target = document.getElementById(id);
          return {
            navBottom: nav.getBoundingClientRect().bottom,
            headingTop: target.getBoundingClientRect().top,
          };
        }, heading.id);
        if (measured.headingTop < measured.navBottom - 1) covered.push(heading);
      }
      await page.evaluate(() => {
        history.replaceState(null, "", location.pathname);
        window.scrollTo({ top: 0, behavior: "instant" });
      });

      return covered.length === 0
        ? null
        : `${covered.length} anchored heading(s) land under the sticky nav, first: "#${covered[0].id}"`;
    },
  },
  {
    id: "no-positive-tabindex",
    pages: ALL,
    check: async (page) => {
      // A positive tabindex does not move one element forward; it moves every
      // element without one to the back of the queue, for the whole page.
      const positive = await page.evaluate(() =>
        Array.from(document.querySelectorAll("[tabindex]"))
          .map((el) => ({
            value: el.getAttribute("tabindex"),
            where: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}`,
          }))
          .filter((entry) => Number(entry.value) > 0)
      );
      return positive.length === 0
        ? null
        : `${positive.length} positive tabindex value(s), first: ${positive[0].where} has tabindex="${positive[0].value}"`;
    },
  },
  {
    id: "history-images-inline",
    pages: ["about", "services"],
    check: async (page, ctx) => {
      const missing = await page.evaluate((wanted) => {
        const inline = new Set(
          Array.from(document.querySelectorAll("img"))
            .filter((img) => !img.closest(".modal"))
            .map((img) => (img.getAttribute("src") ?? "").split("/").pop())
        );
        return wanted.filter((file) => !inline.has(file));
      }, HISTORY_IMAGES[ctx.name]);
      return missing.length === 0
        ? null
        : `${missing.length} photograph(s) still reachable only through a modal: ${missing.join(", ")}`;
    },
  },
  {
    id: "images-have-alt",
    pages: ["about", "services"],
    check: async (page, ctx) => {
      const report = await page.evaluate((wanted) => {
        const images = Array.from(document.querySelectorAll("img")).map((img) => ({
          file: (img.getAttribute("src") ?? "").split("/").pop(),
          alt: img.getAttribute("alt"),
        }));
        return {
          absent: images.filter((img) => img.alt === null).map((img) => img.file),
          // The photographs this phase brought out of the modals carry the
          // history. None of them is decoration, so none may take alt="".
          empty: images
            .filter((img) => wanted.includes(img.file) && (img.alt ?? "").trim() === "")
            .map((img) => img.file),
        };
      }, HISTORY_IMAGES[ctx.name]);

      if (report.absent.length > 0) {
        return `${report.absent.length} image(s) have no alt attribute at all, first: ${report.absent[0]}`;
      }
      return report.empty.length === 0
        ? null
        : `${report.empty.length} history photograph(s) carry alt="": ${report.empty.join(", ")}`;
    },
  },
  {
    // Somebody driving here should not have to hunt. The footer carries the
    // address on every page, and visit.html says it again where a visitor is
    // already looking for it.
    //
    // contact.html deliberately does not. 46 Dimock Camp Road is where the
    // grounds are, not an address that receives mail — the association has a PO
    // box — so an address printed on the contact page is an invitation to send
    // post that never arrives. Owner's decision, 2026-07-28. If the PO box is
    // ever added here, add it as its own fact; do not reach for this one.
    id: "address-present-on-key-pages",
    pages: ALL,
    check: async (page, ctx) => {
      const text = await page.evaluate(splitFooter);
      const missingFrom = (where) => {
        const gaps = [];
        if (!text[where].includes(ADDRESS_STREET)) gaps.push(`"${ADDRESS_STREET}"`);
        if (!ADDRESS_TOWN.test(text[where])) gaps.push("the town and ZIP");
        return gaps;
      };

      const footerGaps = missingFrom("footer");
      if (footerGaps.length > 0) {
        return `the footer does not carry ${footerGaps.join(" or ")}`;
      }
      if (ctx.name !== "visit") return null;

      const bodyGaps = missingFrom("body");
      return bodyGaps.length === 0
        ? null
        : `visit.html states the address only in the footer — the page itself is missing ${bodyGaps.join(" and ")}`;
    },
  },
  {
    // Gate D, declined 2026-07-28: the number lives on visit.html and nowhere
    // else. A second copy is a second thing to update the day it changes.
    id: "cottage-contact-is-visit-only",
    pages: ALL,
    check: async (page, ctx) => {
      const text = await page.evaluate(
        () => (document.body.textContent ?? "").replace(/\s+/g, " ").trim()
      );
      const hasPhone = COTTAGE_PHONE.test(text);
      const hasSeller = COTTAGE_SELLER.test(text);

      if (ctx.name === "visit") {
        if (!hasPhone) return "visit.html no longer carries the cottage phone number";
        if (!hasSeller) return "visit.html no longer names who to ask about the cottage";
        return null;
      }
      return hasPhone
        ? `${ctx.name}.html carries the cottage phone number — it belongs on visit.html only`
        : null;
    },
  },
  {
    // Two ways in and no more: write to us, or come and find us. The owner cut
    // the postal address, the service times, and the cottage pointer on
    // 2026-07-28 — each of them lives somewhere it is already correct, and a
    // second copy on this page is a second thing to keep true.
    id: "contact-page-completeness",
    pages: ["contact"],
    check: async (page) => {
      const found = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll(".section a")).map((a) =>
          a.getAttribute("href") ?? ""
        );
        return {
          mailto: links.some((href) => /^mailto:DimockCampMeeting@gmail\.com/i.test(href)),
          directions: links.some((href) => /^visit\.html/i.test(href)),
        };
      });

      const gaps = [];
      if (!found.mailto) gaps.push("a mailto: link to DimockCampMeeting@gmail.com");
      if (!found.directions) gaps.push("a link to visit.html for directions");
      return gaps.length === 0 ? null : `the contact page is missing ${gaps.join(", ")}`;
    },
  },
  {
    // Gate D, declined 2026-07-28. The host runs PHP, so this stays a check
    // rather than a fact of the platform: mailto: is the contact mechanism, and
    // no page may come to depend on the server. viewlogs.php is reached by URL
    // and linked from nothing — that is what keeps it out of this net.
    id: "no-forms-on-site",
    pages: ALL,
    check: async (page) => {
      const found = await page.evaluate(() => ({
        forms: document.querySelectorAll("form").length,
        php: Array.from(document.querySelectorAll("[href], [src], [action]"))
          .map((el) =>
            el.getAttribute("href") ?? el.getAttribute("src") ?? el.getAttribute("action") ?? ""
          )
          .filter((value) => /\.php(\?|#|$)/i.test(value)),
      }));

      if (found.forms > 0) return `${found.forms} <form> element(s) — the site takes no submissions`;
      return found.php.length === 0
        ? null
        : `${found.php.length} reference(s) to a PHP endpoint, first: ${found.php[0]}`;
    },
  },
  {
    id: "map-iframe-labelled",
    pages: ["visit"],
    check: async (page) => {
      const frames = await page.evaluate(() =>
        Array.from(document.querySelectorAll("iframe")).map((frame) => ({
          src: (frame.getAttribute("src") ?? "").slice(0, 40),
          title: (frame.getAttribute("title") ?? "").trim(),
          loading: frame.getAttribute("loading"),
        }))
      );
      if (frames.length === 0) return "the map iframe is gone";

      const untitled = frames.filter((frame) => frame.title === "");
      if (untitled.length > 0) {
        // An unlabelled frame is announced as "frame" and nothing else.
        return `${untitled.length} iframe(s) have no title, first: ${untitled[0].src}…`;
      }
      const eager = frames.filter((frame) => frame.loading !== "lazy");
      return eager.length === 0
        ? null
        : `${eager.length} iframe(s) are not loading="lazy", first: ${eager[0].src}…`;
    },
  },
];
