import { createRequire } from "node:module";
import { specs, PAGES } from "./specs.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PW_MODULE);

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
    page.on("pageerror", (error) => consoleErrors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.goto(`${BASE_URL}/${name}.html`, { waitUntil: "networkidle" });

    if (WANT_SHOTS) {
      await page.screenshot({
        path: `docs/screens/${name}-${viewport.name}.png`,
        fullPage: true,
      });
    }

    for (const spec of specs) {
      if (!spec.pages.includes(name)) continue;
      let detail;
      try {
        detail = await spec.check(page, { consoleErrors, name, viewport, BASE_URL });
      } catch (error) {
        detail = `threw: ${error.message}`;
      }
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
