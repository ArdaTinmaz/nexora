const fs = require('fs');
const path = require('path');

const getBundledUploadsDir = () => path.join(__dirname, '..', 'uploads');

const normalizeDir = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  return path.resolve(value);
};

const getPrimaryUploadsDir = () =>
  normalizeDir(process.env.NEXORA_UPLOADS_DIR) || getBundledUploadsDir();

const getLegacyUploadsDirs = () => {
  const primaryDir = getPrimaryUploadsDir();
  const candidates = [
    normalizeDir(process.env.NEXORA_LEGACY_UPLOADS_DIR),
    getBundledUploadsDir(),
  ].filter(Boolean);

  return [...new Set(candidates)].filter((dir) => dir !== primaryDir);
};

const ensureUploadsDir = () => {
  fs.mkdirSync(getPrimaryUploadsDir(), { recursive: true });
};

const copyMissingFiles = (sourceDir, targetDir) => {
  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
    return;
  }

  fs.mkdirSync(targetDir, { recursive: true });

  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  entries.forEach((entry) => {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyMissingFiles(sourcePath, targetPath);
      return;
    }

    if (!fs.existsSync(targetPath)) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  });
};

const migrateLegacyUploads = () => {
  const primaryDir = getPrimaryUploadsDir();
  getLegacyUploadsDirs().forEach((legacyDir) => {
    copyMissingFiles(legacyDir, primaryDir);
  });
};

module.exports = {
  ensureUploadsDir,
  getPrimaryUploadsDir,
  getLegacyUploadsDirs,
  migrateLegacyUploads,
};
