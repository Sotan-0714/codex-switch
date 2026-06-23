const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

async function listCodexProcesses() {
  const { stdout } = await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-Command",
    "Get-CimInstance Win32_Process | Where-Object { (($_.Name -ieq 'codex.exe') -or ($_.CommandLine -match 'OpenAI\\.Codex|\\\\codex\\.exe|(^|\\s)codex(\\.cmd|\\.exe)?(\\s|$)')) -and ($_.Name -notmatch 'Apivot') -and ($_.CommandLine -notmatch 'apivot') } | Select-Object ProcessId,Name,CommandLine | ConvertTo-Json -Compress"
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

module.exports = { listCodexProcesses, stopProcesses };
