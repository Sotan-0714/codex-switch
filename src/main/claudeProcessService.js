const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

async function listClaudeProcesses() {
  const { stdout } = await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-Command",
    "Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'claude' -or $_.CommandLine -match 'claude-code|claude.cmd|@anthropic-ai/claude-code' } | Select-Object ProcessId,Name,CommandLine | ConvertTo-Json -Compress"
  ]);
  if (!stdout.trim()) return [];
  const parsed = JSON.parse(stdout);
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function stopProcesses(ids) {
  if (!Array.isArray(ids) || !ids.length) return [];
  const safeIds = ids.map((id) => Number(id)).filter(Number.isInteger);
  if (!safeIds.length) return [];
  const command = `Stop-Process -Id ${safeIds.join(",")} -Force -ErrorAction SilentlyContinue`;
  await execFileAsync("powershell.exe", ["-NoProfile", "-Command", command]);
  return safeIds;
}

module.exports = { listClaudeProcesses, stopProcesses };
