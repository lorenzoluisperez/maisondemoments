import { expect, test } from "@playwright/test";

test("beach showcase keeps invitation details behind the seal and provides a complete guest path", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/demo/wedding-beach");
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("button", { name: "Open the blue wedding envelope" })).toBeVisible();
  const shell = page.locator("[class*='staticEnvelope'] [class*='seal']");
  await expect(shell).toHaveCount(1);
  if (testInfo.project.name.startsWith("mobile")) {
    const shellBox = await shell.boundingBox();
    if (!shellBox) throw new Error("The shell is not visible on the sealed envelope");
    const shellCenter = shellBox.y + shellBox.height / 2;
    expect(shellCenter / page.viewportSize()!.height).toBeGreaterThan(.45);
    expect(shellCenter / page.viewportSize()!.height).toBeLessThan(.55);
  }
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

test("the 3D opening completes with a gentle zoom, ordered surf, and replay", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/demo/wedding-beach");
  await page.waitForLoadState("networkidle");
  const renderer = page.locator("[data-envelope-renderer]");
  await expect(renderer).toHaveAttribute("data-ready", "true");
  await expect(renderer.locator("canvas")).toBeVisible();
  const introScene = await page.getByRole("region", { name: "A blue envelope with a seashell seal" }).elementHandle();
  await page.getByRole("button", { name: "Open the blue wedding envelope" }).click();
  await expect(page.getByRole("button", { name: "Skip to invitation" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
  await expect.poll(async () => Number(await renderer.getAttribute("data-progress")), { timeout: 9_000 }).toBeGreaterThan(.75);
  expect(Number(await renderer.getAttribute("data-zoom"))).toBeGreaterThan(1);
  expect(Number(await renderer.getAttribute("data-zoom"))).toBeLessThanOrEqual(1.08);
  await expect(page.getByText("The tide brought us here")).toBeVisible({ timeout: 11_000 });
  expect(await introScene?.evaluate((element) => element.isConnected && element.getAttribute("aria-label") === "Introducing the wedding")).toBe(true);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 7_000 });
  const frames = page.locator("[data-surf-frame]");
  await expect(frames).toHaveCount(4);
  await expect.poll(async () => Number(await frames.nth(1).evaluate((element) => getComputedStyle(element).opacity)), { timeout: 5_000 }).toBeGreaterThan(.8);
  await expect.poll(async () => Number(await frames.nth(2).evaluate((element) => getComputedStyle(element).opacity)), { timeout: 5_000 }).toBeGreaterThan(.8);
  await page.getByRole("button", { name: "Replay envelope opening" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
  await expect(renderer).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Open the blue wedding envelope" }).click();
  await page.getByRole("button", { name: "Skip to invitation" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(errors).toEqual([]);
});

test("an unavailable envelope renderer still lets guests open the invitation", async ({ page }) => {
  await page.route("**/beach-wedding/blue-envelope-mobile-centered.webp", (route) => route.abort());
  await page.goto("/demo/wedding-beach");
  await page.getByRole("button", { name: "Open the blue wedding envelope" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 12_000 });
  await expect(page.getByRole("button", { name: "Wedding details" })).toBeVisible();
});
