import { contrastRatio } from "./contrast.mjs";

export const PAGES = ["index", "about", "services", "events", "visit", "contact"];
export const ALL = PAGES;

const BOOTSTRAP_GREEN = "rgb(25, 135, 84)";
const BOOTSTRAP_RED = "rgb(220, 53, 69)";
const PINE = "rgb(44, 87, 65)";
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
    id: "event-header-fills",
    pages: ["events"],
    check: async (page) => {
      const headers = await page.evaluate(() =>
        Array.from(document.querySelectorAll(".event-card .card-header")).map((header) => ({
          day: (header.querySelector(".event-date")?.textContent ?? "").trim().slice(0, 3),
          background: getComputedStyle(header).backgroundColor,
        }))
      );
      if (headers.length === 0) return "found no .event-card .card-header elements";
      const wanted = { Sun: PINE, Sat: OCHRE_INK };
      const wrong = headers.filter((header) => header.background !== wanted[header.day]);
      if (wrong.length === 0) return null;
      return `${wrong.length} header(s) mis-filled, first: ${wrong[0].day} is ${wrong[0].background}, expected ${wanted[wrong[0].day]}`;
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
];
