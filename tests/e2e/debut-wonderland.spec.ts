import { expect, test } from "@playwright/test";

const groups = ["roses", "candles", "treasures", "blue-bills"];
const openName = "Turn the key";
const celebrant = "Celeste Reyes";

test("the storybook protects its reveal and presents all 72 names and a non-submitting RSVP", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/demo/debut-wonderland");
  const open = page.getByRole("button", { name: openName, exact: true });
  await expect(open).toBeVisible();
  await expect(page.getByRole("heading", { name: celebrant })).toHaveCount(0);
  await expect(page.getByText("Rafael Santos", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "RSVP", exact: true })).toHaveCount(0);
  await expect(page.getByText("The Looking-Glass Conservatory", { exact: false })).toHaveCount(0);
  await open.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: celebrant })).toBeFocused();
  for (const id of groups) {
    await expect(page.locator(`#${id} li`)).toHaveCount(18);
    const jump = page.getByRole("navigation", { name: "Celebration groups" }).locator(`a[href="#${id}"]`);
    expect((await jump.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await jump.focus(); await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expect(page.locator(`#${id}`)).toBeFocused();
  }
  await expect(page.locator("#blue-bills")).toContainText("Remedios Torres");
  await expect(page.locator("#blue-bills")).not.toContainText("₱");
  const details = page.getByRole("button", { name: "Details", exact: true });
  await details.click();
  const dialog = page.getByRole("dialog", { name: "Celebration details" });
  await expect(dialog).toContainText("Imagined venue");
  // Radix portals escape the page scope. The card must retain opaque paper and ink.
  await expect(dialog).toHaveCSS("background-color", "rgb(250, 245, 233)");
  await expect(dialog).toHaveCSS("color", "rgb(38, 62, 80)");
  await expect(dialog.getByRole("button", { name: "Go to RSVP" })).toHaveCSS("background-color", "rgb(250, 245, 233)");
  expect(await dialog.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain("cotton-card-v4.webp");
  await expect.poll(async () => { const box = await dialog.boundingBox(); return !!box && box.y >= 16 && box.y + box.height <= page.viewportSize()!.height - 16; }).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("wonderland-details-card.png") });
  await page.keyboard.press("Escape");
  await expect(details).toBeFocused();
  const watch = page.getByRole("button", { name: "Open celebration details with the pocket watch" });
  await watch.click(); await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape"); await expect(watch).toBeFocused();
  const cat = page.getByRole("button", { name: "Find the Cheshire Cat’s smile" });
  await cat.focus(); await page.keyboard.press("Enter");
  await expect(cat).toHaveAttribute("aria-pressed", "true");
  await expect(cat).toHaveAttribute("aria-pressed", "false");
  await details.click();
  await dialog.getByRole("button", { name: "Go to RSVP" }).click();
  await expect(page.locator("#rsvp")).toBeFocused();
  await expect(page.getByRole("heading", { name: "A Seat at the Table" })).toBeInViewport();
  const writes: string[] = [];
  page.on("request", (request) => { if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) writes.push(request.url()); });
  await page.getByRole("button", { name: "Joyfully accepts" }).click();
  await expect(page.getByRole("status")).toContainText("Nothing was submitted");
  await page.getByRole("button", { name: "Regretfully declines" }).click();
  await expect(page.getByRole("status")).toContainText("regretfully declines");
  expect(writes).toEqual([]);
  await page.locator("#roses li").first().evaluate((element) => { element.textContent = "Maria Alexandra Victoria de los Reyes-Villanueva"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("wonderland-full.png"), fullPage: true });
  await page.getByRole("button", { name: "Replay Wonderland opening" }).click();
  await expect(open).toBeFocused();
  await expect(page.locator("#circle")).toHaveCount(0);
  await open.click();
  await expect(page.getByRole("status")).toBeEmpty();
  expect(errors).toEqual([]);
});

test("the keyhole opens, the introduction holds, and the garden stays mounted at handoff", async ({ page }, testInfo) => {
  await page.goto("/demo/debut-wonderland");
  await page.getByTestId("wonderland-garden").evaluate((element) => { element.setAttribute("data-original-scene", "yes"); });
  const before = await page.getByTestId("wonderland-garden").boundingBox();
  const keyBefore = await page.getByTestId("wonderland-key").evaluate((element) => getComputedStyle(element).transform);
  await page.getByRole("button", { name: openName, exact: true }).click();
  await expect(page.locator("main")).toHaveAttribute("data-stage", "opening");
  await expect.poll(() => page.getByTestId("wonderland-key").evaluate((element) => getComputedStyle(element).transform)).not.toBe(keyBefore);
  await expect.poll(() => page.getByTestId("wonderland-key-turn").evaluate((element) => getComputedStyle(element).transform)).not.toBe("none");
  await expect.poll(() => page.getByTestId("wonderland-cover").evaluate((element) => Number(getComputedStyle(element).getPropertyValue("--portal-scale")))).toBeGreaterThan(2);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("keyhole-opening.png") });
  await expect(page.locator("main")).toHaveAttribute("data-stage", "intro");
  await expect(page.getByTestId("wonderland-foreground")).toHaveCSS("opacity", "1");
  const foregroundBefore = await page.getByTestId("wonderland-foreground").boundingBox();
  const readableHold = await page.evaluate(() => new Promise<number>((resolve) => {
    const intro = document.querySelector('[class*="intro__"], [class$="__intro"]')!;
    let readableAt: number | null = null;
    const started = performance.now();
    const sample = (now: number) => {
      const opacity = Number(getComputedStyle(intro).opacity);
      if (opacity >= .999 && readableAt === null) readableAt = now;
      if (opacity < .999 && readableAt !== null) { resolve(now - readableAt); return; }
      if (now - started > 8000) { resolve(0); return; }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));
  expect(readableHold).toBeGreaterThanOrEqual(3000);
  await expect(page.getByRole("heading", { name: celebrant })).toBeVisible();
  await expect(page.getByTestId("wonderland-garden")).toHaveAttribute("data-original-scene", "yes");
  await expect(page.getByTestId("wonderland-foreground")).toHaveCSS("opacity", "1");
  await expect(page.getByTestId("wonderland-foreground")).toBeVisible();
  const foregroundAfter = await page.getByTestId("wonderland-foreground").boundingBox();
  expect(foregroundAfter!.y).toBeCloseTo(foregroundBefore!.y, 0);
  const after = await page.getByTestId("wonderland-garden").boundingBox();
  expect(after!.width / before!.width).toBeCloseTo(1.025, 2);
  expect(after!.height / before!.height).toBeCloseTo(1.025, 2);
  await page.screenshot({ path: testInfo.outputPath("wonderland-revealed.png") });
  await page.getByRole("button", { name: "Replay Wonderland opening" }).click();
  await page.getByRole("button", { name: openName, exact: true }).click();
  await page.getByRole("button", { name: "Skip to invitation" }).click();
  await page.getByRole("button", { name: "Replay Wonderland opening" }).click();
  await page.waitForTimeout(11500);
  await expect(page.locator("main")).toHaveAttribute("data-stage", "sealed");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
  await expect(page.getByTestId("wonderland-foreground")).toHaveCSS("opacity", "0");
});

test("critical artwork failure still permits a static invitation and expired countdown", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2027-08-16T00:00:00+08:00"));
  await page.route("**/debut-wonderland/garden-*-v1.webp", (route) => route.abort());
  await page.goto("/demo/debut-wonderland");
  await page.getByRole("button", { name: openName, exact: true }).click();
  await expect(page.getByRole("heading", { name: celebrant })).toBeVisible();
  await expect(page.getByText("The celebration has begun.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip to invitation" })).toHaveCount(0);
  await page.getByRole("button", { name: "RSVP", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A Seat at the Table" })).toBeInViewport();
});

test("reduced motion interrupts an active opening and delayed preparation can be skipped", async ({ page }) => {
  await page.goto("/demo/debut-wonderland");
  await page.getByRole("button", { name: openName, exact: true }).click();
  await expect(page.locator("main")).toHaveAttribute("data-stage", "opening");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByRole("heading", { name: celebrant })).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip to invitation" })).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/debut-wonderland/paper-arch-*-v1.webp", async (route) => { await waiting; await route.continue(); });
  await page.goto("/demo/debut-wonderland", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: openName, exact: true }).click();
  await expect(page.locator("main")).toHaveAttribute("data-stage", "preparing");
  await page.getByRole("button", { name: "Skip to invitation" }).click();
  await expect(page.getByRole("heading", { name: celebrant })).toBeVisible();
  release();
  await page.locator('[class*="tunnelArch"] img').first().evaluate((element: HTMLImageElement) => element.decode());
  await expect(page.locator("main")).toHaveAttribute("data-stage", "revealed");
});

test("portrait and landscape artwork retain proportions and the opening target remains visible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/demo/debut-wonderland");
  for (const viewport of [{ width: 1470, height: 746 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 2560, height: 1080 }, { width: 844, height: 390 }, { width: 320, height: 667 }]) {
    await page.setViewportSize(viewport);
    const portrait = viewport.width <= viewport.height;
    const scene = page.getByTestId("wonderland-garden").locator("img");
    await expect.poll(() => scene.evaluate((element: HTMLImageElement) => element.currentSrc)).toContain(portrait ? "garden-mobile" : "garden-desktop");
    await scene.evaluate((element: HTMLImageElement) => element.decode());
    await expect(scene).toHaveCSS("object-fit", "cover");
    const ratio = await scene.evaluate((element: HTMLImageElement) => element.naturalWidth / element.naturalHeight);
    expect(ratio).toBeCloseTo(portrait ? 2 / 3 : 3 / 2, 2);
    const hit = await page.getByRole("button", { name: openName, exact: true }).boundingBox();
    expect(hit!.height).toBeGreaterThanOrEqual(44);
    expect(hit!.x).toBeGreaterThan(0); expect(hit!.y).toBeGreaterThan(0);
    expect(hit!.x + hit!.width).toBeLessThan(viewport.width);
    expect(hit!.y + hit!.height).toBeLessThan(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  }
  await page.getByRole("button", { name: openName, exact: true }).click();
  const monogram = await page.getByTestId("wonderland-invitation-card").locator('[class*="monogram"]').boundingBox();
  expect(monogram!.width).toBeCloseTo(monogram!.height, 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("music starts only through a guest gesture and mute preference survives replay", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => { if (request.url().endsWith("there-is-romance.mp3")) requests.push(request.url()); });
  await page.goto("/demo/debut-wonderland");
  expect(requests).toHaveLength(0);
  const audio = page.locator("audio");
  expect(await audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  await page.getByRole("button", { name: openName, exact: true }).click();
  await expect(page.getByRole("button", { name: "Mute music" })).toBeVisible();
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Skip to invitation" }).click();
  await page.getByRole("button", { name: "Mute music" }).click();
  await page.getByRole("button", { name: "Replay Wonderland opening" }).click();
  expect(await audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBe(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: openName, exact: true }).click();
  await expect(page.getByRole("heading", { name: celebrant })).toBeVisible();
  expect(await audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  await page.getByRole("button", { name: "Play music" }).click();
  await expect(page.getByRole("button", { name: "Mute music" })).toBeVisible();
});

test("missing music never blocks details or a sample response", async ({ page }) => {
  await page.route("**/there-is-romance.mp3", (route) => route.abort());
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/demo/debut-wonderland");
  await page.getByRole("button", { name: openName, exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry music" })).toBeVisible();
  await expect(page.getByRole("heading", { name: celebrant })).toBeVisible();
  await page.getByRole("button", { name: "RSVP", exact: true }).click();
  await page.getByRole("button", { name: "Joyfully accepts" }).click();
  await expect(page.getByRole("status")).toContainText("Nothing was submitted");
});
