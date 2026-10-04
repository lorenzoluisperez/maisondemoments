import { expect, test } from "@playwright/test";

test("wedding and debut designs are discoverable with fictional previews", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your story deserves a beautiful beginning." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Discover the design" })).toHaveCount(5);
  await expect(page.getByRole("link", { name: "Explore the designs" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Customer sign in" })).toHaveCount(0);

  for (const [slug, name, preview] of [
    ["garden-romance", "Garden Romance", "/demo/wedding"],
    ["coastal-romance", "Coastal Romance", "/demo/wedding-beach"],
    ["heritage-romance", "Heritage Romance", "/demo/wedding-bridgerton"],
    ["pearl-and-poise", "Pearl & Poise", "/demo/debut-pearl"],
    ["eighteen-in-wonderland", "Eighteen in Wonderland", "/demo/debut-wonderland"],
  ]) {
    await page.goto(`/designs/${slug}`);
    await expect(page.getByRole("heading", { name, exact: true, level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Experience the full sample" })).toHaveAttribute("href", preview);
    await expect(page.getByText("Fictional sample. Sample replies are not submitted.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ask about Essential" })).toHaveAttribute("href", "/how-to-order#contact");
    await expect(page.getByRole("link", { name: "Choose essential" })).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  }
});

test("ordering instructions and social contact placeholders are clear", async ({ page }) => {
  await page.goto("/how-to-order");
  await expect(page.getByRole("heading", { name: "How to order", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choose a design" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Send us a message" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plan it together" })).toBeVisible();
  await expect(page.locator(".boutique-social-links")).toContainText("Facebook");
  await expect(page.locator(".boutique-social-links")).toContainText("Instagram");
  await expect(page.locator(".boutique-social-links svg")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});

test("paused purchase and workspace paths lead to ordering instructions", async ({ page }) => {
  for (const path of ["/checkout?design=garden-romance&tier=essential", "/portal", "/designs/garden-romance/quote", "/login", "/admin", "/studio"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/how-to-order$/);
  }
});


test("the debut category links to its sample without wedding metrics", async ({ page }) => {
  const metrics: string[] = [];
  page.on("request", (request) => { if (request.url().includes("/api/commerce/metrics/view")) metrics.push(request.url()); });
  await page.goto("/designs");
  await expect(page.getByRole("heading", { name: "Debuts / 18th Birthdays" })).toBeVisible();
  await page.locator('#debut a[href="/designs/pearl-and-poise"]').first().click();
  await expect(page.getByRole("heading", { name: "Pearl & Poise", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Experience the full sample" })).toHaveAttribute("href", "/demo/debut-pearl");
  await page.goto("/designs/eighteen-in-wonderland");
  await expect(page.getByRole("heading", { name: "Eighteen in Wonderland", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Experience the full sample" })).toHaveAttribute("href", "/demo/debut-wonderland");
  expect(metrics).toEqual([]);
});

test("the current debut cards are shown uncropped throughout discovery", async ({ page }) => {
  for (const [slug, version] of [["pearl-and-poise", "v3"], ["eighteen-in-wonderland", "v2"]]) {
  for (const path of ["/", "/designs", `/designs/${slug}`]) {
    await page.goto(path);
    const preview = page.locator(`[data-image-treatment="stationery"] img[src*="invitation-preview-${version}"]`);
    await preview.scrollIntoViewIfNeeded();
    await preview.evaluate((image: HTMLImageElement) => image.decode());
    const source = await preview.getAttribute("src");
    expect(decodeURIComponent(source!)).toMatch(new RegExp(`invitation-preview-${version}\\.[a-zA-Z0-9_.-]+\\.webp`));
    await expect(preview).toHaveCSS("object-fit", "contain");
    expect(await preview.evaluate((image: HTMLImageElement) => image.naturalWidth > 0 && image.naturalHeight > image.naturalWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  }
  }
});
