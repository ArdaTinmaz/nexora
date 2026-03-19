const { execSync } = require("child_process");

const platform = process.platform;

let targetCommand;

if (platform === "darwin") {
  targetCommand = "electron-builder --mac dmg";
} else if (platform === "win32") {
  targetCommand = "electron-builder --win nsis";
} else {
  console.error(
    `[dist] Unsupported platform: ${platform}. Use "npm run dist:mac" or "npm run dist:win" on a supported OS.`
  );
  process.exit(1);
}

console.log(`[dist] Platform: ${platform}`);
console.log(`[dist] Running: ${targetCommand}`);

execSync(targetCommand, { stdio: "inherit" });
