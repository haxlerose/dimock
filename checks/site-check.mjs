import { createRequire } from "node:module";
import { specs, PAGES } from "./specs.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PW_MODULE);

/**
 * Freezes the clock a page sees, installed before any of the document's own
 * script runs. The multi-argument constructor is deliberately left alone:
 * schedule.js builds `new Date(y, m - 1, d)` to get local midnight, and
 * stubbing that away would test something the site never does.
 */
export const stubClock = (page, iso) =>
  page.addInitScript((frozen) => {
    const RealDate = Date;
    const fixed = new RealDate(frozen).getTime();
    class StubDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) super(fixed);
        else super(...args);
      }
      static now() {
        return fixed;
      }
    }
    window.Date = StubDate;
  }, iso);

/**
 * The Google Maps embed on visit.html intermittently throws inside its own
 * scripts — "google is not defined" out of maps.gstatic.com, roughly one load
 * in ten — and reports it into the host page's console. It is not thrown by any
 * file in this repository and no change to the site can prevent it, which is
 * the same reason visible-focus-ring exempts the map iframe. Only these three
 * hosts are excused; Google Fonts is deliberately not among them, so a font
 * that fails to load is still a failure.
 */
const EMBED_HOSTS = ["maps.gstatic.com", "maps.googleapis.com", "www.google.com"];

const isOurError = (message) => {
  if (message.type() !== "error") return false;
  const url = message.location()?.url ?? "";
  if (!url) return true;
  try {
    return !EMBED_HOSTS.includes(new URL(url).hostname);
  } catch {
    return true;
  }
};

/** Records this page's own errors into `sink`, ignoring the map embed's. */
const watchConsole = (page, sink) => {
  page.on("pageerror", (error) => sink.push(String(error)));
  page.on("console", (message) => {
    if (isOurError(message)) sink.push(message.text());
  });
};

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:8811";
const WANT_SHOTS = process.argv.includes("--shots");
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const failures = [];
let passed = 0;

const browser = await chromium.launch({ executablePath: process.env.PW_EXECUTABLE });

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });

  for (const name of PAGES) {
    const page = await context.newPage();
    const consoleErrors = [];
    watchConsole(page, consoleErrors);

    await page.goto(`${BASE_URL}/${name}.html`, { waitUntil: "networkidle" });

    if (WANT_SHOTS) {
      await page.screenshot({
        path: `docs/screens/${name}-${viewport.name}.png`,
        fullPage: true,
      });
    }

    for (const spec of specs) {
      if (!spec.pages.includes(name)) continue;

      const ctx = { consoleErrors, name, viewport, BASE_URL };

      // A spec that pins the clock gets a page of its own. The stub has to be
      // in place before the document's scripts run, so it cannot be bolted on
      // to the page every other spec is already sharing.
      //
      // The clock may be a function rather than a literal date. It is handed
      // the already-loaded, unstubbed page, so a spec can say "the day after
      // the last service" and read that out of events.html instead of naming a
      // date that stops being true when next season is pasted in.
      let target = page;
      let scoped = null;
      let detail;
      try {
        const clockAt =
          typeof spec.clock === "function" ? await spec.clock(page, ctx) : spec.clock;
        if (clockAt) {
          scoped = await context.newPage();
          ctx.consoleErrors = [];
          watchConsole(scoped, ctx.consoleErrors);
          await stubClock(scoped, clockAt);
          await scoped.goto(`${BASE_URL}/${name}.html`, { waitUntil: "networkidle" });
          target = scoped;
        }
        detail = await spec.check(target, ctx);
      } catch (error) {
        detail = `threw: ${error.message}`;
      }
      if (scoped) await scoped.close();

      if (detail) failures.push({ spec: spec.id, page: name, viewport: viewport.name, detail });
      else passed += 1;
    }

    await page.close();
  }

  await context.close();
}

await browser.close();

for (const failure of failures) {
  console.error(
    `FAIL  ${failure.spec}  ${failure.page}.html @ ${failure.viewport}\n      ${failure.detail}`
  );
}
console.log(`${passed} passed, ${failures.length} failed`);
process.exit(failures.length === 0 ? 0 : 1);
