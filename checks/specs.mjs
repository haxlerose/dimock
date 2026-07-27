import { contrastRatio } from "./contrast.mjs";

export const PAGES = ["index", "about", "services", "events", "visit", "contact"];
export const ALL = PAGES;

const BOOTSTRAP_GREEN = "rgb(25, 135, 84)";
const BOOTSTRAP_RED = "rgb(220, 53, 69)";
const PINE = "rgb(44, 87, 65)";
const PINE_DEEP = "rgb(31, 64, 48)";
const OCHRE_INK = "rgb(138, 86, 24)";

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
      const wanted = [PINE, OCHRE_INK];
      const offPalette = cards.filter((card) => !wanted.includes(card.dayTinted));
      return offPalette.length === 0
        ? null
        : `an .event-day is ${offPalette[0].dayTinted}, expected one of ${wanted.join(" / ")}`;
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
        const heritage = await centered(".heritage-band p");
        if (heritage === null) return "found no paragraphs in .heritage-band";
        return heritage ? "the heritage paragraph is still centred" : null;
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
];
