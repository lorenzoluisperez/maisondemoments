import { expect, test } from "@playwright/test";

test("the three wedding products are discoverable with fictional previews", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your story deserves a beautiful beginning." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Discover the design" })).toHaveCount(3);
  await expect(page.getByRole("link", { name: "Explore the designs" })).toBeVisible();

  for (const [slug, name, preview] of [
    ["garden-romance", "Garden Romance", "/demo/wedding"],
    ["coastal-romance", "Coastal Romance", "/demo/wedding-beach"],
    ["heritage-romance", "Heritage Romance", "/demo/wedding-bridgerton"],
  ]) {
    await page.goto(`/designs/${slug}`);
    await expect(page.getByRole("heading", { name, exact: true, level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Experience the full sample" })).toHaveAttribute("href", preview);
    await expect(page.getByText("Fictional sample. Sample replies are not submitted.")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  }
});
