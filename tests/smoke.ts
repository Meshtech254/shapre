import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
async function main() {
  const base = process.env.SMOKE_URL ?? "http://localhost:3000";
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    await mkdir("test-results", { recursive: true });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base, { waitUntil: "networkidle" });
    assert.match(await page.locator("h1").innerText(), /Stream as your/);
    await page.screenshot({
      path: "test-results/landing-desktop.png",
      fullPage: true,
    });
    await page
      .getByRole("link", { name: "Create your persona", exact: true })
      .first()
      .click();
    await page.waitForURL("**/signup");
    assert.equal(
      await page
        .getByRole("button", { name: "Create account", exact: true })
        .count(),
      1,
    );
    await page.screenshot({
      path: "test-results/signup-desktop.png",
      fullPage: true,
    });
    for (const route of [
      "/dashboard",
      "/personas",
      "/personas/new",
      "/studio",
      "/settings",
      "/billing",
    ]) {
      await page.goto(`${base}${route}`);
      assert.match(page.url(), /\/login/);
    }
    for (const route of [
      "/legal/terms",
      "/legal/privacy",
      "/legal/acceptable-use",
    ]) {
      const response = await page.goto(`${base}${route}`);
      assert.equal(response?.status(), 200);
      assert.ok((await page.locator("h1").innerText()).length > 3);
    }
    const api = await page.request.post(`${base}/api/v1/personas`, {
      data: { name: "Unauthorized", consentFace: true },
    });
    assert.ok([401, 503].includes(api.status()));
    const output = await page.request.get(
      `${base}/api/v1/output/00000000-0000-4000-8000-000000000000?token=invalid`,
    );
    assert.equal(output.status(), 403);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base, { waitUntil: "networkidle" });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: "test-results/landing-mobile.png",
      fullPage: true,
    });
    await page.goto(`${base}/signup`);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: "test-results/signup-mobile.png",
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    console.log(
      "Smoke passed: landing, signup, protected redirects, legal pages, denied API/output access, mobile layout, no browser errors.",
    );
  } finally {
    await browser.close();
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
