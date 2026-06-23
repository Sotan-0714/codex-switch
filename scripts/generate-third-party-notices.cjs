const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const lock = require(path.join(root, "package-lock.json"));
const rootPackage = lock.packages[""];
const seen = new Set();

function visit(name) {
  if (seen.has(name)) return;
  seen.add(name);
  const entry = lock.packages[`node_modules/${name}`];
  for (const dependency of Object.keys(entry?.dependencies || {})) visit(dependency);
}

for (const dependency of Object.keys(rootPackage.dependencies || {})) visit(dependency);
visit("electron");

const packages = [...seen].map((name) => {
  const packageDir = path.join(root, "node_modules", name);
  const packageFile = path.join(packageDir, "package.json");
  const metadata = fs.existsSync(packageFile) ? JSON.parse(fs.readFileSync(packageFile, "utf8")) : {};
  const repository = typeof metadata.repository === "string" ? metadata.repository : metadata.repository?.url;
  const licenseFile = fs.existsSync(packageDir)
    ? fs.readdirSync(packageDir).find((file) => /^(license|licence|copying|notice)(\.|$)/i.test(file) && fs.statSync(path.join(packageDir, file)).isFile())
    : "";
  return { name, version: metadata.version || "unknown", license: metadata.license || "see package", url: metadata.homepage || repository || "", licenseText: licenseFile ? fs.readFileSync(path.join(packageDir, licenseFile), "utf8").trim() : "" };
}).sort((a, b) => a.name.localeCompare(b.name));

const table = packages.map((item) => `| ${item.name} | ${item.version} | ${item.license} | ${item.url} |`).join("\n");
const exactNotices = packages.map((item) => `## ${item.name} ${item.version}\n\nLicense: ${item.license}${item.url ? `  \nProject: ${item.url}` : ""}\n\n${item.licenseText || "No separate license file was included in the installed package. Refer to the package metadata and project repository listed above."}`).join("\n\n---\n\n");
const output = `# Apivot Third-Party License Notices

Generated for Apivot ${rootPackage.version}. Apivot is released under the MIT License. The following third-party components remain subject to their respective open-source licenses.

| Package | Version | License | Project |
| --- | --- | --- | --- |
${table}

## Electron, Chromium, and Node.js

The packaged application also preserves Electron's LICENSE file and Chromium's generated third-party notice file. Those bundled files contain the detailed copyright and license terms for Chromium, Node.js, and their components.

## Package License Texts

${exactNotices}
`;

fs.mkdirSync(path.join(root, "legal"), { recursive: true });
fs.writeFileSync(path.join(root, "legal", "THIRD_PARTY_NOTICES.md"), output, "utf8");
console.log(`Wrote notices for ${packages.length} packages.`);
