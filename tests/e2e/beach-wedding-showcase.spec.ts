import { expect, test } from "@playwright/test";

test("beach showcase keeps invitation details behind the seal and provides a complete guest path", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/demo/wedding-beach");
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("button", { name: "Open the blue wedding envelope" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Music on" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Lorenzo/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Wedding details" })).toHaveCount(0);
  await page.getByRole("button", { name: "Open the blue wedding envelope" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Lorenzo");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Cham");
  await expect(page.getByText(/Tagaytay/i)).toHaveCount(0);
  const paintedFrames = page.locator("[data-surf-frame]");
  await expect(paintedFrames).toHaveCount(4);
  await expect(paintedFrames.first()).toHaveCSS("opacity", "1");
  await expect(paintedFrames.nth(1)).toHaveCSS("opacity", "0");
  await page.getByRole("button", { name: "Wedding details" }).click();
  const details = page.getByRole("dialog", { name: "Wedding details" });
  await expect(details).toContainText("Monday, 14 June 2027");
  await expect(details).toContainText("Amihan Beach Pavilion");
  await expect(details).toContainText("Hiraya Shore Hall");
  await expect(details).toContainText("Boracay Island");
  await details.getByRole("button", { name: "Go to RSVP" }).click();
  await expect(page.locator("#rsvp-title")).toBeInViewport();
  await page.getByRole("button", { name: "Joyfully accepts" }).click();
  await expect(page.getByRole("status")).toContainText("Nothing was submitted");
  expect(errors).toEqual([]);
});

test("the envelope zooms slowly before the ordered painted surf begins", async ({ page }) => {
  await page.goto("/demo/wedding-beach");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Open the blue wedding envelope" }).click();
  await expect(page.getByRole("button", { name: "Skip to invitation" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
  const stage = page.locator("[class*='envelopeStage']");
  await expect.poll(async () => stage.evaluate((element) => Number(new DOMMatrix(getComputedStyle(element).transform).a)), { timeout: 5_000 }).toBeGreaterThan(1.05);
  await expect(page.getByText("The tide brought us here")).toBeVisible({ timeout: 11_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 7_000 });
  const frames = page.locator("[data-surf-frame]");
  await expect(frames).toHaveCount(4);
  await expect.poll(async () => Number(await frames.nth(1).evaluate((element) => getComputedStyle(element).opacity)), { timeout: 5_000 }).toBeGreaterThan(.8);
  await expect.poll(async () => Number(await frames.nth(2).evaluate((element) => getComputedStyle(element).opacity)), { timeout: 5_000 }).toBeGreaterThan(.8);
});
