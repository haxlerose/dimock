export const PAGES = ["index", "about", "services", "events", "visit", "contact"];
export const ALL = PAGES;

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
];
