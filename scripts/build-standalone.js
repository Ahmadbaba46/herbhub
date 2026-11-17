#!/usr/bin/env node
/* Bundles HerbHub into a single self-contained HTML file at dist/herbhub.html
 * by inlining the CSS and JS. Run: node scripts/build-standalone.js */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let html = read("index.html");
const css = read("assets/css/styles.css");
const store = read("assets/js/store.js");
const app = read("assets/js/app.js");

html = html.replace(
  '<link rel="stylesheet" href="assets/css/styles.css" />',
  "<style>\n" + css + "\n</style>"
);
html = html.replace(
  '<script src="assets/js/store.js"></script>',
  "<script>\n" + store + "\n</script>"
);
html = html.replace(
  '<script src="assets/js/app.js"></script>',
  "<script>\n" + app + "\n</script>"
);

const outDir = path.join(ROOT, "dist");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "herbhub.html"), html);
console.log("Built dist/herbhub.html (" + html.length + " bytes)");
