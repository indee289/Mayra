#!/usr/bin/env node
/**
 * copy-web.js
 * Copies the static web app (living at repo root) into the Capacitor
 * webDir ("www") so that `npx cap sync android` bundles it into the APK.
 * Runs with plain Node — no external dependencies — so it works both
 * locally and on the GitHub Actions runner.
 */
const fs = require('fs');
const path = require('path');

const root = __dirname ? path.resolve(__dirname, '..') : process.cwd();
const dest = path.join(root, 'www');

// Web assets to bundle into the WebView.
const ITEMS = ['index.html', 'manifest.json', 'sw.js', 'css', 'js', 'assets'];

function rimraf(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function copyRecursive(src, dst) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dst, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

rimraf(dest);
fs.mkdirSync(dest, { recursive: true });

for (const item of ITEMS) {
  const src = path.join(root, item);
  if (!fs.existsSync(src)) {
    console.warn(`[copy-web] skip missing: ${item}`);
    continue;
  }
  copyRecursive(src, path.join(dest, item));
  console.log(`[copy-web] copied: ${item}`);
}

console.log(`[copy-web] done -> ${dest}`);
