import { expect, test } from "@playwright/test";

test("the Filipino heritage invitation protects details and provides the complete guest path", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/demo/wedding-bridgerton");
  await expect(page.getByRole("button", { name: "Open the pearl-sealed wedding envelope" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Lorenzo/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Wedding details" })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("bridgerton-sealed.png") });

  await page.getByRole("button", { name: "Open the pearl-sealed wedding envelope" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Lorenzo");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Cham");
  await expect(page.locator("#countdown")).toContainText("14 June 2027");
  await expect(page.locator("#attire")).toContainText("Filipino formal");
  await expect(page.locator("#celebration")).toContainText("Amihan Courtyard");
  await expect(page.locator("#celebration")).toContainText("Hiraya Heritage Hall");
  await expect(page.locator("#entourage").getByRole("heading", { name: "Parents" })).toBeVisible();
  await expect(page.locator("#entourage").getByRole("heading", { name: "Bearers" })).toHaveCount(0);
  await expect(page.locator("#program").locator("li")).toHaveCount(8);
  await expect(page.locator("#program")).toContainText("Dancing");
  await page.screenshot({ path: testInfo.outputPath("bridgerton-hero.png") });

  await page.getByRole("button", { name: "Wedding details" }).click();
  const details = page.getByRole("dialog", { name: "Wedding details" });
  await expect(details).toContainText("Filipino formal");
  await expect(details).toContainText("Intramuros, Manila");
  await expect(details.getByRole("link", { name: /map/i })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(details).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Wedding details" })).toBeFocused();
  await page.getByRole("button", { name: "Wedding details" }).click();
  await details.getByRole("button", { name: "Go to RSVP" }).click();
  await expect(page.locator("#rsvp-title")).toBeInViewport();
  await page.getByRole("button", { name: "Joyfully accepts" }).click();
  await expect(page.getByRole("status")).toContainText("Nothing was submitted");
  expect(errors).toEqual([]);
});

test("the envelope holds the introduction, then supports replay and skip", async ({ page }) => {
  await page.goto("/demo/wedding-bridgerton");
  await page.getByRole("button", { name: "Open the pearl-sealed wedding envelope" }).click();
  await expect(page.getByRole("button", { name: "Skip to invitation" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
  // A positive X rotation lifts the sealed tip toward the guest, then over the top hinge.
  await expect.poll(() => page.getByTestId("bridgerton-flap").evaluate((flap) =>
    new DOMMatrix(getComputedStyle(flap).transform).m23,
  ), { timeout: 3_000 }).toBeGreaterThan(0.15);
  await expect(page.getByText("Two stories.")).toBeVisible({ timeout: 7_000 });
  await expect(page.getByText("One forever.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 7_000 });
  await page.getByRole("button", { name: "Replay envelope opening" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
  await page.getByRole("button", { name: "Open the pearl-sealed wedding envelope" }).click();
  await page.getByRole("button", { name: "Skip to invitation" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Replay envelope opening" }).click();
  await page.waitForTimeout(9_000);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open the pearl-sealed wedding envelope" })).toBeVisible();
});

test("missing envelope art still opens the invitation", async ({ page }) => {
  await page.route("**/bridgerton-wedding/envelope-*.webp", (route) => route.abort());
  await page.goto("/demo/wedding-bridgerton");
  await page.getByRole("button", { name: "Open the pearl-sealed wedding envelope" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Wedding details" })).toBeVisible();
});
