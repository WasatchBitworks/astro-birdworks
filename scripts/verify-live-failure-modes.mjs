/**
 * Verifies /live behavior in a real (headless) browser across three scenarios:
 *
 *   A. Happy path — server island renders fresh stats.
 *   B. Island route/function failure — simulated by aborting all
 *      /_server-islands/* requests. Expects the 10s watchdog to replace the
 *      skeleton with the error state and "Refresh Now" to reload the page.
 *   C. CMS unavailable — dev server started with a dead BIRDS_API_BASE.
 *      Expects the island itself to render its "Live Data Temporarily
 *      Unavailable" empty state (watchdog must NOT fire).
 *
 * Usage:
 *   node scripts/verify-live-failure-modes.mjs              # local dev servers
 *   node scripts/verify-live-failure-modes.mjs <base-url>   # A+B against a deploy
 *
 * Scenario C always needs a local server (the CMS outage is server-side),
 * so it is skipped when a remote base URL is given.
 */
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const WATCHDOG_MS = 10_000;
const remoteBase = process.argv[2] ?? null;

let failures = 0;
const pass = (msg) => console.log(`  ✅ ${msg}`);
const fail = (msg) => {
  failures++;
  console.error(`  ❌ ${msg}`);
};

async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} did not become ready`);
}

function startDevServer(port, env = {}) {
  const proc = spawn("npx", ["astro", "dev", "--port", String(port)], {
    env: { ...process.env, ...env },
    stdio: "ignore",
    detached: false,
  });
  return proc;
}

async function scenarioA(browser, base) {
  console.log("\nScenario A: happy path (island renders fresh data)");
  const page = await browser.newPage();
  await page.goto(`${base}/live`, { waitUntil: "domcontentloaded" });

  try {
    await page.waitForSelector("#liveFeedRoot", { timeout: 30_000 });
    pass("server island rendered");

    const statText = await page.textContent("#statDetections").catch(() => null);
    if (statText !== null && /^\d+$/.test(statText.trim())) {
      pass(`stats populated (detections: ${statText.trim()})`);
    } else if (await page.$("[data-live-error]")) {
      fail("watchdog error state shown on happy path");
    } else {
      // Zero-detection day renders the island's own empty state — still healthy
      pass("island rendered its empty state (no detections right now)");
    }
  } catch (e) {
    fail(`island never rendered: ${e.message}`);
  }
  await page.close();
}

async function scenarioB(browser, base) {
  console.log("\nScenario B: island route/function failure (requests aborted)");
  const page = await browser.newPage();
  await page.route("**/_server-islands/**", (route) => route.abort());
  await page.goto(`${base}/live`, { waitUntil: "domcontentloaded" });

  // Skeleton should be up initially, no error state yet
  if (await page.$("#liveFallback")) {
    pass("fallback skeleton shown initially");
  } else {
    fail("fallback skeleton missing");
  }
  if (await page.$("[data-live-error]")) {
    fail("error state appeared before the watchdog window");
  }

  // Wait out the watchdog
  await page.waitForTimeout(WATCHDOG_MS + 2_000);

  if (await page.$("[data-live-error]")) {
    pass("watchdog replaced skeleton with error state after ~10s");
  } else {
    fail("watchdog did not show the error state");
  }

  const status = await page.textContent("#statusText").catch(() => "");
  if (status?.includes("unavailable")) {
    pass(`status text set ("${status.trim()}")`);
  } else {
    fail(`status text not updated (got "${status}")`);
  }

  // "Refresh Now" must perform a full page reload
  await page.evaluate(() => {
    window.__notReloaded = true;
  });
  await page.click("#refreshBtn");
  try {
    await page.waitForFunction(() => window.__notReloaded === undefined, { timeout: 10_000 });
    pass('"Refresh Now" performed a full page reload');
  } catch {
    fail('"Refresh Now" did not reload the page');
  }

  await page.close();
}

async function scenarioC(browser, base) {
  console.log("\nScenario C: CMS unavailable (island renders its error state)");
  const page = await browser.newPage();
  await page.goto(`${base}/live`, { waitUntil: "domcontentloaded" });

  try {
    await page.waitForSelector("#liveFeedRoot", { timeout: 30_000 });
    pass("server island rendered despite CMS outage");
  } catch {
    fail("island never rendered");
    await page.close();
    return;
  }

  const body = await page.textContent("#liveFeedRoot");
  if (body?.includes("Live Data Temporarily Unavailable")) {
    pass('island shows "Live Data Temporarily Unavailable"');
  } else {
    fail("island did not show its CMS-outage empty state");
  }

  // Watchdog must not fire — the island DID arrive
  await page.waitForTimeout(WATCHDOG_MS + 2_000);
  if (await page.$("[data-live-error]")) {
    fail("watchdog error state fired even though the island rendered");
  } else {
    pass("watchdog stayed quiet (island present)");
  }

  await page.close();
}

const browser = await chromium.launch();
const procs = [];

try {
  if (remoteBase) {
    console.log(`Running A+B against ${remoteBase} (C requires a local server — skipped)`);
    await scenarioA(browser, remoteBase.replace(/\/$/, ""));
    await scenarioB(browser, remoteBase.replace(/\/$/, ""));
  } else {
    console.log("Starting dev server (normal) on :4451 ...");
    procs.push(startDevServer(4451));
    await waitForServer("http://localhost:4451/");

    await scenarioA(browser, "http://localhost:4451");
    await scenarioB(browser, "http://localhost:4451");

    console.log("\nStarting dev server (dead BIRDS_API_BASE) on :4452 ...");
    procs.push(startDevServer(4452, { BIRDS_API_BASE: "http://127.0.0.1:9/api/birds" }));
    await waitForServer("http://localhost:4452/");

    await scenarioC(browser, "http://localhost:4452");
  }
} finally {
  await browser.close();
  for (const proc of procs) proc.kill("SIGTERM");
}

console.log(failures === 0 ? "\nAll /live failure-mode checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
