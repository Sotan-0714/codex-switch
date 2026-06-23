const fs = require("fs/promises");
const path = require("path");

/**
 * Atomically write data to a file.
 *
 * Writes to a temporary file in the SAME directory as the target (so the final
 * rename is on the same filesystem/volume and is atomic), flushes it to disk,
 * then renames it over the target. If anything fails before the rename, the
 * original target file is left untouched and the temp file is cleaned up.
 *
 * @param {string} filePath absolute path to the destination file
 * @param {string|Buffer} data file contents
 * @param {string} [encoding="utf8"] encoding (ignored for Buffer data)
 */
async function atomicWriteFile(filePath, data, encoding = "utf8") {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const tmpPath = path.join(
    dir,
    `.${base}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 10)}`
  );

  let handle;
  try {
    // Open the temp file, write, and fsync so data hits disk before the rename.
    handle = await fs.open(tmpPath, "w");
    await handle.writeFile(data, Buffer.isBuffer(data) ? undefined : encoding);
    try {
      await handle.sync();
    } catch {
      // fsync may be unavailable on some filesystems; the rename still gives us
      // atomic replacement of the target, so this is best-effort only.
    }
    await handle.close();
    handle = null;

    // rename is atomic within the same directory/volume.
    await fs.rename(tmpPath, filePath);
  } catch (error) {
    if (handle) {
      try {
        await handle.close();
      } catch {
        // ignore close failure during cleanup
      }
    }
    // Clean up the temp file; never touch the original target on failure.
    try {
      await fs.rm(tmpPath, { force: true });
    } catch {
      // ignore cleanup failure
    }
    throw error;
  }
}

module.exports = { atomicWriteFile };
