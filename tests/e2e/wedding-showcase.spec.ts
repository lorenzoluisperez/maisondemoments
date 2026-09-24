import { expect, test } from "@playwright/test";

test("seal target opens through the romantic reveal to the names card", async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/demo/wedding");
  const openButton = page.getByRole("button", { name: "Tap the wax seal to open the envelope" });
  await expect(openButton).toBeVisible();

  const centerY = await openButton.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return (bounds.top + bounds.height / 2) / window.innerHeight;
  });
  const expectedSealPosition = testInfo.project.name.startsWith("mobile") ? 0.5 : 0.69;
  expect(Math.abs(centerY - expectedSealPosition)).toBeLessThan(0.025);
  await expect(page.getByRole("button", { name: /skip intro/i })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("envelope-closed.png") });

  await openButton.click();
  await expect(page.getByText("Two stories", { exact: true })).toBeAttached({ timeout: 22_000 });
  await expect(page.getByText("One forever", { exact: true })).toBeAttached();
  await expect(page.locator("#opening-title")).toContainText("Lorenzo", { timeout: 28_000 });
  await expect(page.locator("#opening-title")).toContainText("Cham");
  await expect(page.locator("#opening-title span").last()).toHaveCSS("opacity", "1");
  await expect(page.getByRole("button", { name: /skip intro/i })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("names-card.png") });
  expect(pageErrors).toEqual([]);
});

test("details links reach entourage and program, and empty optional groups stay hidden", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/demo/wedding");
  const openButton = page.getByRole("button", { name: "Tap the wax seal to open the envelope" });
  const sealCenter = await page.getByTestId("static-envelope-seal").evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.top + bounds.height / 2;
  });
  const targetCenter = await openButton.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.top + bounds.height / 2;
  });
  const promptCenter = await page.getByTestId("opening-prompt").evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.top + bounds.height / 2;
  });
  expect(Math.abs(sealCenter - targetCenter)).toBeLessThan(12);
  expect(promptCenter).toBeGreaterThan(sealCenter);
  await page.screenshot({ path: testInfo.outputPath("envelope-static.png") });
  await openButton.click();
  await expect(page.locator("#opening-title")).toContainText("Lorenzo");

  await page.getByRole("button", { name: "Wedding details" }).click();
  const details = page.getByRole("dialog", { name: "Wedding details" });
  await expect(details).toBeVisible();
  await expect(details.getByRole("link", { name: "Open map" })).toHaveCount(0);
  await details.getByRole("button", { name: "Meet the entourage" }).click();
  await expect(page.locator("#entourage-title")).toContainText("The people beside us");
  await expect(page.locator("#entourage").getByRole("heading", { name: "Principal Sponsors" })).toBeVisible();
  await expect(page.locator("#entourage").getByRole("heading", { name: "Bearers" })).toHaveCount(0);
  await expect(page.locator("#entourage").getByRole("heading", { name: "Flower Girls" })).toHaveCount(0);
  await page.locator("#entourage").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("entourage.png") });

  await page.getByRole("button", { name: "Wedding details" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "View the program" }).click();
  await expect(page.locator("#program-title")).toContainText("A few moments to look forward to");
  await expect(page.locator("#program")).toContainText("Guest arrival");
  await expect(page.locator("#program")).toContainText("Dancing");
  await page.locator("#program").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("program.png") });
});

test("a failed story photo falls back to a watercolor keepsake", async ({ page }, testInfo) => {
  await page.route("**/_next/image**", async (route) => {
    const source = new URL(route.request().url()).searchParams.get("url") ?? "";
    if (source.includes("bookshop.webp")) {
      await route.fulfill({ status: 404, contentType: "text/plain", body: "Missing demo photo" });
      return;
    }
    await route.continue();
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/demo/wedding");
  await page.getByRole("button", { name: "Tap the wax seal to open the envelope" }).click();
  await expect(page.locator("#opening-title")).toContainText("Lorenzo");

  const bookshop = page.locator("#bookshop");
  await bookshop.evaluate((element) => element.scrollIntoView({ block: "start" }));
  await expect(bookshop.getByRole("heading", { name: "Good stories find their people" })).toBeVisible();
  await expect(bookshop.locator("[data-story-photo]")).toHaveCount(0);
  await expect(bookshop.locator("[data-photo-placeholder]")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("bookshop-no-photo.png") });
  for (const chapter of ["proposal", "venue"]) {
    await page.locator(`#${chapter}`).evaluate((element) => element.scrollIntoView({ block: "start" }));
    await page.screenshot({ path: testInfo.outputPath(`${chapter}.png`) });
  }
});
