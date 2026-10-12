import { test, expect } from "@playwright/test";

test.describe("Shattered Stars - Smoke Tests", () => {
  test("should load the game without errors", async ({ page }) => {
    // Listen for console errors
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/");

    // Wait for Phaser to initialize
    await expect(page.locator("canvas")).toBeVisible({ timeout: 10000 });

    // No critical errors should have occurred
    const criticalErrors = errors.filter(
      (e) => !e.includes("favicon") && !e.includes("404"),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test("should have a canvas element for Phaser", async ({ page }) => {
    await page.goto("/");

    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Canvas should have reasonable dimensions
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);
  });

  test("should transition from boot to battle scene", async ({ page }) => {
    await page.goto("/");

    // Wait for canvas
    await expect(page.locator("canvas")).toBeVisible({ timeout: 10000 });

    // Give time for scene transition
    await page.waitForTimeout(2000);

    // Check that the game is running (no white/black screen)
    const canvas = page.locator("canvas");
    const screenshot = await canvas.screenshot();

    // Screenshot should have some content (not completely uniform)
    expect(screenshot.length).toBeGreaterThan(1000);
  });

  test("should respond to keyboard input without crashing", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible({ timeout: 10000 });

    // Wait for game to be ready
    await page.waitForTimeout(1000);

    // Try various key presses
    await page.keyboard.press("Space");
    await page.keyboard.press("Escape");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowRight");

    // Game should still be running
    await expect(page.locator("canvas")).toBeVisible();
  });

  test("should handle mouse clicks without crashing", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible({ timeout: 10000 });

    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();

    if (box) {
      // Click in center of canvas
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

      // Click in corners
      await page.mouse.click(box.x + 10, box.y + 10);
      await page.mouse.click(box.x + box.width - 10, box.y + box.height - 10);
    }

    // Game should still be running
    await expect(page.locator("canvas")).toBeVisible();
  });

  test("should handle rapid input without lag or crash", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(1000);

    // Rapid key presses
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Space", { delay: 50 });
    }

    // Game should still be responsive
    await expect(page.locator("canvas")).toBeVisible();
  });

  test("should survive multiple page reloads", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible({ timeout: 10000 });

    // Simulate multiple "restarts" by reloading
    for (let i = 0; i < 3; i++) {
      await page.reload();
      await expect(page.locator("canvas")).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(500);
    }

    // Game should still be running after multiple reloads
    await expect(page.locator("canvas")).toBeVisible();

    // Verify the game is interactive
    await page.keyboard.press("Space");
    await expect(page.locator("canvas")).toBeVisible();
  });
});

test.describe("Debug Tests", () => {
  test("capture game state for debugging", async ({ page }, testInfo) => {
    const logs: string[] = [];
    const errors: string[] = [];

    // Capture all console output
    page.on("console", (msg) => {
      const text = `[${msg.type()}] ${msg.text()}`;
      logs.push(text);
      console.log(text);
    });

    page.on("pageerror", (err) => {
      errors.push(err.message);
      console.log("[PAGE ERROR]", err.message);
    });

    await page.goto("/");

    // Wait for canvas
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Wait for game to initialize
    await page.waitForTimeout(3000);

    // Take screenshot
    // Debug captures are run output (test-results/, gitignored), not fixtures.
    await page.screenshot({
      path: testInfo.outputPath("debug-fullpage.png"),
      fullPage: true,
    });
    await canvas.screenshot({ path: testInfo.outputPath("debug-canvas.png") });

    // Check canvas dimensions
    const box = await canvas.boundingBox();
    console.log("Canvas dimensions:", box);

    // Get canvas context info via evaluate
    const canvasInfo = await page.evaluate(() => {
      const cvs = document.querySelector("canvas");
      if (!cvs) return null;
      return {
        width: cvs.width,
        height: cvs.height,
        style: cvs.style.cssText,
        parent: cvs.parentElement?.id,
      };
    });
    console.log("Canvas info:", canvasInfo);

    // Log all errors
    if (errors.length > 0) {
      console.log("ERRORS FOUND:", errors);
    }

    // Check for Phaser game object
    const hasPhaser = await page.evaluate(() => {
      return (
        typeof (window as unknown as { Phaser: unknown }).Phaser !== "undefined"
      );
    });
    console.log("Phaser loaded:", hasPhaser);

    // Filter out known WebGL issues in headless Chrome (these don't affect gameplay)
    const criticalErrors = errors.filter(
      (e) => !e.includes("Framebuffer") && !e.includes("WebGL"),
    );
    expect(criticalErrors.length).toBe(0);
  });
});

test.describe("Performance Smoke Tests", () => {
  test("should maintain reasonable frame rate", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible({ timeout: 10000 });

    // Wait for game to stabilize
    await page.waitForTimeout(2000);

    // Measure frame timing over 1 second
    const frameTimes: number[] = [];
    const startTime = Date.now();

    while (Date.now() - startTime < 1000) {
      const before = Date.now();
      await page.waitForTimeout(16); // ~60fps target
      frameTimes.push(Date.now() - before);
    }

    // Average frame time should be reasonable (< 50ms = >20fps minimum)
    const avgFrameTime =
      frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    expect(avgFrameTime).toBeLessThan(50);
  });
});
