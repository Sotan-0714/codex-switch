const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "outputs", "qa", "vite-smoke");

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function requestOk(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(url, child) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Vite exited early with code ${child.exitCode}.`);
    if (await requestOk(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    return chromium.launch({ headless: true });
  }
}

async function acceptEulaIfPresent(page) {
  if (!(await page.locator(".eula-backdrop").count())) return;
  const checkbox = page.locator(".eula-backdrop input[type='checkbox']").first();
  if (await checkbox.count()) await checkbox.check({ force: true });
  await page.getByText("同意并继续").click();
  await page.waitForTimeout(300);
}

async function run() {
  fs.mkdirSync(outDir, { recursive: true });
  const port = await findFreePort();
  const url = `http://127.0.0.1:${port}/`;
  const viteBin = path.join(path.dirname(require.resolve("vite/package.json")), "bin", "vite.js");
  const child = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", String(port)], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, BROWSER: "none" }
  });
  const serverLog = [];
  child.stdout.on("data", (chunk) => serverLog.push(String(chunk)));
  child.stderr.on("data", (chunk) => serverLog.push(String(chunk)));

  let browser;
  const logs = [];
  try {
    await waitForServer(url, child);
    browser = await launchBrowser();
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1 });
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) logs.push(`${message.type()}: ${message.text()}`);
    });
    page.on("pageerror", (error) => logs.push(`pageerror: ${error.message}`));

    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForSelector(".app-shell", { timeout: 15000 });
    await acceptEulaIfPresent(page);

    const title = await page.title();
    const bodyText = await page.locator("body").innerText();
    await page.screenshot({ path: path.join(outDir, "01-default.png"), fullPage: false });

    await page.getByLabel("Collapse sidebar").click();
    await page.waitForTimeout(250);
    const collapsedCount = await page.locator(".app-shell.sidebar-collapsed").count();
    await page.screenshot({ path: path.join(outDir, "02-collapsed.png"), fullPage: false });

    await page.getByLabel("Expand sidebar").click();
    await page.waitForTimeout(250);
    await page.locator(".nav-list .nav-item").nth(2).click();
    await page.waitForTimeout(300);
    const profileText = await page.locator("body").innerText();
    await page.screenshot({ path: path.join(outDir, "03-profile.png"), fullPage: false });

    const result = {
      ok: true,
      url,
      title,
      hasApivot: bodyText.includes("Apivot"),
      hasSwitch: bodyText.includes("切换") || bodyText.includes("Switch"),
      hasProfile: /Profile|配置档案/.test(profileText),
      collapsedCount,
      logs,
      screenshots: outDir
    };
    if (!result.hasApivot || !result.hasSwitch || !result.hasProfile || collapsedCount !== 1 || logs.length) {
      throw new Error(`Vite smoke failed: ${JSON.stringify(result, null, 2)}`);
    }
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (browser) await browser.close();
    child.kill();
    fs.writeFileSync(path.join(outDir, "vite-server.log"), serverLog.join(""), "utf8");
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
