const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

function validateEnvName(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name || "")) {
    throw new Error(`Invalid environment variable name: ${name || "(empty)"}`);
  }
}

async function setUserEnvVar(name, value) {
  validateEnvName(name);
  if (!value) throw new Error(`Cannot write empty value for ${name}.`);
  await execFileAsync("setx.exe", [name, value], { windowsHide: true });
  process.env[name] = value;
  return { name };
}

async function deleteUserEnvVar(name) {
  validateEnvName(name);
  await execFileAsync("reg.exe", ["delete", "HKCU\\Environment", "/v", name, "/f"], { windowsHide: true }).catch(() => {});
  delete process.env[name];
  return { name };
}

module.exports = { setUserEnvVar, deleteUserEnvVar, validateEnvName };
