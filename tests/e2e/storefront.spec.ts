import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import en from "../../messages/en.json";

async function localOrders(): Promise<
  { orderNumber: string; total: number; email: string }[]
> {
  try {
    return JSON.parse(await readFile(".orders.dev.json", "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

for (const locale of ["en", "ar"] as const) {
  test(`${locale}: storefront has working photography and no horizontal overflow`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const width of [
      320, 360, 390, 414, 640, 768, 820, 1024, 1280, 1536, 1920, 2560, 3840,
    ]) {
      await page.setViewportSize({ width, height: 900 });
      if (width === 320) await page.goto(`/${locale}`);
      await expect(page.locator("h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBeTruthy();
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator("#collection").scrollIntoViewIfNeeded();
    const images = page.locator("#collection img");
    await expect(images).toHaveCount(4);
    await expect
      .poll(() =>
        images.evaluateAll((imgs) =>
          imgs.every((img) => (img as HTMLImageElement).naturalWidth > 0),
        ),
      )
      .toBeTruthy();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `test-results/lune-${locale}-desktop.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `test-results/lune-${locale}-mobile.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });

  test(`${locale}: shop filtering, product gallery, cart and accessible checkout`, async ({
    page,
    context,
  }) => {
    const before = await localOrders();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${locale}/shop?audience=women`);
    await expect(page.locator('a[href*="/product/"]')).toHaveCount(2);
    await page.goto(`/${locale}/product/apollo`);
    const thumbs = page.locator('[role="group"] button[aria-pressed]');
    await thumbs.nth(1).click();
    await expect(thumbs.nth(1)).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("button", {
        name: locale === "en" ? "Add to Cart" : "أضف إلى السلة",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", {
        name: locale === "en" ? "View cart" : "عرض السلة",
        exact: true,
      })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page
      .getByRole("button", {
        name:
          locale === "en" ? "Increase Apollo quantity" : "زيادة كمية Apollo",
      })
      .click();
    const second = await context.newPage();
    await second.goto(`/${locale}/shop`);
    await page
      .getByRole("link", {
        name: locale === "en" ? "Checkout" : "إتمام الطلب",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(`/${locale}/checkout`);
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page
      .getByRole("button", {
        name: locale === "en" ? "Place Order" : "تأكيد الطلب",
        exact: true,
      })
      .click();
    await expect(page.locator("#name")).toBeFocused();
    await expect(page.locator("#name")).toHaveAttribute("aria-invalid", "true");
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(audit.violations).toEqual([]);
    await page.locator("#name").fill("Lune QA");
    await page.locator("#phone").fill("0790000000");
    await page.locator("#city").fill("Amman");
    await page.locator("#address").fill("Local test address");
    // Email intentionally blank: only the isolated local dev store is used.
    await page
      .getByRole("button", {
        name: locale === "en" ? "Place Order" : "تأكيد الطلب",
        exact: true,
      })
      .dblclick();
    await expect(page).toHaveURL(/\/confirmation\?order=L-[A-Z0-9]+/);
    const after = await localOrders();
    expect(after).toHaveLength(before.length + 1);
    const created = after.find(
      (order) =>
        order.orderNumber === new URL(page.url()).searchParams.get("order"),
    );
    expect(created).toMatchObject({ total: 73, email: "" });
    await expect(page.locator("main")).not.toContainText(
      locale === "en" ? "A receipt has been sent" : "أرسلنا إيصال",
    );
    await second.goto(`/${locale}/checkout`);
    await expect(
      second.getByRole("link", {
        name: locale === "en" ? "Explore the Collections" : "اكتشف التوليفات",
        exact: true,
      }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/lune-${locale}-confirmation.png`,
      fullPage: true,
    });
  });

  test(`${locale}: invalid confirmation does not claim an order exists`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/confirmation?order=not-an-order`);
    await expect(page.locator("h1")).toHaveText(
      locale === "en" ? "Your Lune order" : "طلبك من Lune",
    );
  });
}

test("locale switch preserves shop filter and keyboard skip link works", async ({
  page,
}) => {
  await page.goto("/en/shop?audience=women");
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await expect(page).toHaveURL("/ar/shop?audience=women");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator('a[href*="/product/"]')).toHaveCount(2);
  await page.goto("/en");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
});

test("admin sign-out removes the cookie at its original path", async ({
  page,
  context,
}) => {
  await page.goto("/admin");
  await page.getByLabel("Password").fill("local-playwright-fixture-only");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  expect(
    (await context.cookies()).find((cookie) => cookie.name === "lune_admin")
      ?.path,
  ).toBe("/admin");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByLabel("Password")).toBeVisible();
  expect(
    (await context.cookies()).some((cookie) => cookie.name === "lune_admin"),
  ).toBeFalsy();
  await page.goto("/admin/orders");
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("checkout rejects stale totals, duplicate lines and unsupported payment methods", async ({
  page,
}) => {
  const before = await localOrders();
  await page.goto("/en/product/apollo");
  await page.getByRole("button", { name: "Add to Cart", exact: true }).click();
  await page.goto("/en/checkout");
  await page.locator("#name").fill("Lune QA");
  await page.locator("#phone").fill("0790000000");
  await page.locator("#city").fill("Amman");
  await page.locator("#address").fill("Local test address");
  let mode: "total" | "duplicate" | "card" = "total";
  await page.route("**/en/checkout", async (route) => {
    if (!route.request().headers()["next-action"]) return route.continue();
    const body = JSON.parse(route.request().postData()!);
    if (mode === "total") body[0].expectedTotal = 1;
    if (mode === "duplicate") body[0].items.push({ ...body[0].items[0] });
    if (mode === "card") body[0].paymentMethod = "card";
    await route.continue({ postData: JSON.stringify(body) });
  });
  for (const nextMode of ["total", "duplicate", "card"] as const) {
    mode = nextMode;
    await page
      .getByRole("button", { name: "Place Order", exact: true })
      .click();
    await expect(
      page
        .getByRole("alert")
        .filter({
          hasText:
            nextMode === "total"
              ? en.checkout.errPriceChanged
              : en.checkout.errValidation,
        }),
    ).toBeVisible();
    expect(await localOrders()).toHaveLength(before.length);
  }
});
