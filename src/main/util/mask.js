// Mask a secret for display/logging: show only the first 2 and last 2 chars
// (or *** when too short) so screenshots/logs never leak a meaningful prefix.
function maskSecret(value) {
  if (!value) return "";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

module.exports = { maskSecret };
