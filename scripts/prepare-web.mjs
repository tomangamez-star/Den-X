import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "www");

const files = [
  "index.html",
  "project.html",
  "open-project.html",
  "settings.html",
  "workspace.html",
  "figure-creator.html",
  "manifest.webmanifest",
  "sw.js"
];

const directories = ["css", "icons", "js"];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of files) {
  await cp(resolve(root, file), resolve(output, file));
}

for (const directory of directories) {
  await cp(resolve(root, directory), resolve(output, directory), {
    recursive: true
  });
}

console.log("Prepared DenX web assets in www/");
