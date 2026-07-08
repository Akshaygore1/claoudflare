import { chromium } from "playwright";

const URL = "http://localhost:5173";
const EMAIL = process.env.REPRO_LOGIN_EMAIL;
const PASSWORD = process.env.REPRO_LOGIN_PASSWORD;
const LOOPS = 3; // Number of times to repeat the loop

function requireEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function main() {
  const email = requireEnv("REPRO_LOGIN_EMAIL", EMAIL);
  const password = requireEnv("REPRO_LOGIN_PASSWORD", PASSWORD);

  console.log("Starting browser automation...");
  // Launch the browser in non-headless mode so you can see it
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    for (let i = 1; i <= LOOPS; i++) {
      console.log(`\n--- Iteration ${i} of ${LOOPS} ---`);

      // 1. Navigate to Login
      console.log("Navigating to /login...");
      await page.goto(`${URL}/login`);
      await page.waitForURL("**/login");

      // 2. Fill credentials and sign in
      console.log("Filling in credentials...");
      await page.fill('input[name="email"]', email);
      await page.fill('input[name="password"]', password);

      console.log('Clicking "Sign In"...');
      await page.click('button[type="submit"]');

      // 3. Wait for dashboard
      console.log("Waiting for redirect to /dashboard...");
      await page.waitForURL("**/dashboard");
      console.log("Successfully logged in.");

      // 4. Open User Menu / Sign out
      console.log('Clicking "Sign Out" from Dashboard...');
      const signOutBtn = page.getByRole("button", { name: /Sign Out/i });
      await signOutBtn.waitFor({ state: "visible" });
      await signOutBtn.click();

      // 5. Wait for redirect to home
      console.log("Waiting for redirect to home (/)....");
      await page.waitForURL((url) => url.pathname === "/");
      console.log("Successfully signed out.");

      // 6. Click Start Dubbing
      console.log('Clicking "Start Dubbing"...');
      await page.getByRole("button", { name: /Start Dubbing/i }).click();

      // Wait for it to redirect back to login to complete the cycle
      console.log("Waiting for redirect back to /login...");
      await page.waitForURL("**/login");
      console.log(`Iteration ${i} complete.`);

      // Small pause between loops
      await page.waitForTimeout(1000);
    }
  } catch (error) {
    console.error("Automation encountered an error:", error);
  } finally {
    console.log("Closing browser in 3 seconds...");
    try {
      await page.waitForTimeout(3000);
    } catch {}
    try {
      await browser.close();
    } catch {}
  }
}

main();
