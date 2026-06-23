const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { _electron: electron } = require("playwright");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "outputs", "qa", "electron-smoke");

async function acceptEulaIfPresent(page) {
  if (!(await page.locator(".eula-backdrop").count())) return;
  const checkbox = page.locator(".eula-backdrop input[type='checkbox']").first();
  if (await checkbox.count()) await checkbox.check({ force: true });
  await page.getByText("同意并继续").click();
  await page.waitForTimeout(300);
}

async function setWindowSize(app, width, height) {
  return app.evaluate(({ BrowserWindow }, bounds) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.setSize(bounds.width, bounds.height);
    win.center();
    return win.getBounds();
  }, { width, height });
}

async function run() {
  fs.mkdirSync(outDir, { recursive: true });
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "apivot-electron-smoke-"));
  const logs = [];
  let app;
  try {
    app = await electron.launch({
      args: ["."],
      cwd: root,
      env: { ...process.env, APIVOT_USER_DATA_DIR: userDataDir }
    });
    const page = await app.firstWindow();
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) logs.push(`${message.type()}: ${message.text()}`);
    });
    page.on("pageerror", (error) => logs.push(`pageerror: ${error.message}`));

    await page.waitForSelector(".app-shell", { timeout: 20000 });
    await acceptEulaIfPresent(page);
    await page.screenshot({ path: path.join(outDir, "01-default.png"), fullPage: false });
    const title = await page.title();
    const bodyText = await page.locator("body").innerText();

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

    await page.getByLabel(/设置|Settings/).click();
    await page.waitForTimeout(300);
    const settingsText = await page.locator("body").innerText();
    await page.screenshot({ path: path.join(outDir, "04-settings.png"), fullPage: false });

    const smallBounds = await setWindowSize(app, 980, 720);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, "05-min-window.png"), fullPage: false });

    const result = {
      ok: true,
      title,
      userDataDir,
      hasApivot: bodyText.includes("Apivot"),
      hasSwitch: bodyText.includes("切换") || bodyText.includes("Switch"),
      hasProfile: /Profile|配置档案/.test(profileText),
      hasSettings: /设置|Settings/.test(settingsText),
      collapsedCount,
      smallBounds,
      logs,
      screenshots: outDir
    };
    if (!result.hasApivot || !result.hasSwitch || !result.hasProfile || !result.hasSettings || collapsedCount !== 1 || logs.length) {
      throw new Error(`Electron smoke failed: ${JSON.stringify(result, null, 2)}`);
    }
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (app) await app.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
