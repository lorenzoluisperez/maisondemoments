import { expect, test } from "@playwright/test";

const groups = ["roses", "candles", "treasures", "blue-bills"];

test("the debut protects its reveal and provides the complete guest journey", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/demo/debut-pearl");
  const open = page.getByRole("button", { name: "Open the pearl-sealed debut invitation" });
  await expect(open).toBeVisible();
  await expect(page.getByRole("heading", { name: "Amara Santos" })).toHaveCount(0);
  await expect(page.getByText("Rafael Santos", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "RSVP", exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("pearl-sealed.png"), fullPage: true });
  await open.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Amara Santos" })).toBeFocused();
  for (const id of groups) await expect(page.locator(`#${id} li`)).toHaveCount(18);
  await expect(page.locator("#blue-bills")).toContainText("Remedios Torres");
  await expect(page.locator("#blue-bills")).not.toContainText("₱");
  for (const id of groups) {
    const jump = page.getByRole("navigation", { name: "Celebration groups" }).locator(`a[href="#${id}"]`);
    await jump.focus();
    expect((await jump.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expect(page.locator(`#${id}`)).toBeFocused();
    await expect(page.locator(`#${id}-title`)).toBeInViewport();
  }
  await expect(page.getByText("Manila time", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "Details", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Celebration details" });
  await expect(dialog).toContainText("Imagined venue");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Details", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await dialog.getByRole("button", { name: "Go to RSVP" }).click();
  await expect(page.getByRole("heading", { name: "Kindly reply" })).toBeInViewport();
  const writes: string[] = [];
  page.on("request", (request) => { if (request.method() === "POST") writes.push(request.url()); });
  await page.getByRole("button", { name: "Joyfully accepts" }).click();
  await expect(page.getByRole("status")).toContainText("Nothing was submitted");
  await page.getByRole("button", { name: "Regretfully declines" }).click();
  await expect(page.getByRole("status")).toContainText("regretfully declines");
  expect(writes).toEqual([]);
  await page.locator("#roses li").first().evaluate((element) => { element.textContent = "Maria Alexandra Victoria de los Reyes-Villanueva"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("pearl-full.png"), fullPage: true });
  await page.getByRole("button", { name: "Replay envelope opening" }).click();
  await expect(open).toBeFocused();
  await expect(page.locator("#circle")).toHaveCount(0);
  await open.click();
  await expect(page.getByRole("status")).toBeEmpty();
  expect(errors).toEqual([]);
});

test("opening lifts outward, holds the introduction, and replays without stale timers", async ({ page }, testInfo) => {
  await page.goto("/demo/debut-pearl");
  const paper = page.locator('[class*="paperBorder"]').locator("..");
  const before = await paper.boundingBox();
  await page.getByRole("button", { name: "Open the pearl-sealed debut invitation" }).click();
  await expect.poll(() => page.getByTestId("pearl-flap").evaluate((flap) => new DOMMatrix(getComputedStyle(flap).transform).m23), { timeout: 2000 }).toBeGreaterThan(.15);
  await page.screenshot({ path: testInfo.outputPath("pearl-flap.png") });
  await expect(page.getByText("A beautiful chapter begins.", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
  // Measure the readable interval in the browser, without counting screenshot latency.
  const readableDuration = page.evaluate(() => new Promise<number>((resolve) => {
    let readableAt: number | null = null;
    const started = performance.now();
    const measure = (now: number) => {
      const intro = document.querySelector('[class*="intro__"], [class$="__intro"]');
      const opacity = intro ? Number(getComputedStyle(intro).opacity) : 0;
      if (opacity >= .999 && readableAt === null) readableAt = now;
      if (opacity < .999 && readableAt !== null) { resolve(now - readableAt); return; }
      if (now - started > 10000) { resolve(0); return; }
      requestAnimationFrame(measure);
    };
    requestAnimationFrame(measure);
  }));
  await page.waitForTimeout(700);
  // The envelope must completely leave the viewport before the readable hold.
  expect((await page.locator('[class*="pocket__"], [class$="__pocket"]').boundingBox())?.y).toBeGreaterThanOrEqual(page.viewportSize()!.height);
  await expect(page.getByTestId("pearl-flap")).toHaveCSS("opacity", "0");
  await page.screenshot({ path: testInfo.outputPath("pearl-intro.png") });
  expect(await readableDuration).toBeGreaterThanOrEqual(3000);
  await expect(page.getByRole("heading", { name: "Amara Santos" })).toBeVisible();
  const after = await paper.boundingBox();
  expect(after?.x).toBe(before?.x); expect(after?.y).toBe(before?.y); expect(after?.width).toBe(before?.width); expect(after?.height).toBe(before?.height);
  await expect(page.locator('[class*="heroCopy"]')).toHaveCSS("opacity", "1");
  await page.screenshot({ path: testInfo.outputPath("pearl-hero.png") });
  await page.getByRole("button", { name: "Replay envelope opening" }).click();
  await page.getByRole("button", { name: "Open the pearl-sealed debut invitation" }).click();
  await page.getByRole("button", { name: "Skip to invitation" }).click();
  await page.getByRole("button", { name: "Replay envelope opening" }).click();
  await page.waitForTimeout(11500);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
});

test("missing artwork and an expired countdown still leave a usable invitation", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2027-11-09T00:00:00+08:00"));
  await page.route("**/debut-pearl/envelope-*-v2.webp", (route) => route.abort());
  await page.goto("/demo/debut-pearl");
  await page.getByRole("button", { name: "Open the pearl-sealed debut invitation" }).click();
  await expect(page.getByRole("heading", { name: "Amara Santos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip to invitation" })).toHaveCount(0);
  await expect(page.getByText("The celebration has begun.")).toBeVisible();
  await page.getByRole("button", { name: "RSVP", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Kindly reply" })).toBeInViewport();
});

test("switching to reduced motion during the opening completes the reveal", async ({ page }) => {
  await page.goto("/demo/debut-pearl");
  await page.getByRole("button", { name: "Open the pearl-sealed debut invitation" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByRole("heading", { name: "Amara Santos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip to invitation" })).toHaveCount(0);
});

test("the full-screen envelope keeps its proportions between portrait and landscape", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/demo/debut-pearl");
  for (const viewport of [{ width: 1470, height: 746 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 2560, height: 1080 }, { width: 844, height: 390 }, { width: 320, height: 667 }]) {
    await page.setViewportSize(viewport);
    const frame = await page.getByTestId("pearl-envelope-frame").boundingBox();
    expect(frame).not.toBeNull();
    const portrait = viewport.width <= viewport.height;
    expect(frame!.width / frame!.height).toBeCloseTo(portrait ? 2 / 3 : 3 / 2, 2);
    expect(frame!.x).toBeLessThanOrEqual(1);
    expect(frame!.y).toBeLessThanOrEqual(1);
    expect(frame!.x + frame!.width).toBeGreaterThanOrEqual(viewport.width - 1);
    expect(frame!.y + frame!.height).toBeGreaterThanOrEqual(viewport.height - 1);
    const art = await page.locator('[class*="flapFront"]').evaluate(el => getComputedStyle(el).backgroundImage);
    expect(art).toContain(portrait ? "envelope-mobile" : "envelope-desktop");
    const seal = await page.locator('[class*="seal__"], [class$="__seal"]').boundingBox();
    const hit = await page.getByRole("button", { name: "Open the pearl-sealed debut invitation" }).boundingBox();
    expect(hit!.width).toBeGreaterThanOrEqual(44);
    expect(hit!.x).toBeGreaterThan(0);
    expect(hit!.y).toBeGreaterThan(0);
    expect(hit!.x + hit!.width).toBeLessThan(viewport.width);
    expect(hit!.y + hit!.height).toBeLessThan(viewport.height);
    const caption = await page.locator('[class*="openingNote"]').boundingBox();
    expect(hit!.y + hit!.height).toBeLessThan(caption!.y);
    expect(hit!.width).toBeCloseTo(hit!.height, 1);
    // The seal sits 2px above the paper in perspective, allowing a subpixel projected offset.
    expect(Math.abs(hit!.x - seal!.x)).toBeLessThan(2);
    expect(Math.abs(hit!.y - seal!.y)).toBeLessThan(2);
  }
  await page.getByRole("button", { name: "Open the pearl-sealed debut invitation" }).click();
  for (const viewport of [{ width: 390, height: 844 }, { width: 1470, height: 746 }]) {
    await page.setViewportSize(viewport);
    const monogram = await page.locator('[class*="heroCopy"] [class*="monogram"]').boundingBox();
    expect(monogram!.width).toBeCloseTo(monogram!.height, 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  }
});

test("music starts with the guest gesture and respects mute, skip, and replay", async ({ page }) => {
  const audioRequests: string[] = [];
  page.on("request", request => { if (request.url().endsWith("there-is-romance.mp3")) audioRequests.push(request.url()); });
  await page.goto("/demo/debut-pearl");
  await expect(page.getByRole("button", { name: "Open the pearl-sealed debut invitation" })).toBeVisible();
  const audio = page.locator("audio");
  expect(audioRequests).toHaveLength(0);
  expect(await audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  await page.getByRole("button", { name: "Open the pearl-sealed debut invitation" }).click();
  await expect(page.getByRole("button", { name: "Mute music" })).toBeVisible();
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Skip to invitation" }).click();
  await expect(page.getByRole("button", { name: "Mute music" })).toBeVisible();
  await page.getByRole("button", { name: "Mute music" }).click();
  expect(await audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  await page.getByRole("button", { name: "Replay envelope opening" }).click();
  expect(await audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBe(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Open the pearl-sealed debut invitation" }).click();
  await expect(page.getByRole("heading", { name: "Amara Santos" })).toBeVisible();
  expect(await audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  await page.getByRole("button", { name: "Play music" }).click();
  await expect(page.getByRole("button", { name: "Mute music" })).toBeVisible();
  await page.getByRole("button", { name: "Replay envelope opening" }).click();
  expect(await audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
});

test("a missing soundtrack does not block the invitation", async ({ page }) => {
  await page.route("**/there-is-romance.mp3", route => route.abort());
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/demo/debut-pearl");
  await page.getByRole("button", { name: "Open the pearl-sealed debut invitation" }).click();
  await expect(page.getByRole("button", { name: "Retry music" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Amara Santos" })).toBeVisible();
  await page.getByRole("button", { name: "RSVP", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Kindly reply" })).toBeInViewport();
});
