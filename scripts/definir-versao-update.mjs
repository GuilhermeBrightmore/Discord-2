import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const version = process.argv[2]?.trim();
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version ?? "")) {
  console.error("Versao invalida. Use o formato 1.2.3.");
  process.exit(1);
}

const root = process.cwd();
for (const relative of ["package.json", "apps/desktop/package.json"]) {
  const filename = path.join(root, relative);
  const json = JSON.parse(readFileSync(filename, "utf8"));
  json.version = version;
  writeFileSync(filename, `${JSON.stringify(json, null, 2)}\n`);
}

const lockPath = path.join(root, "package-lock.json");
const lock = JSON.parse(readFileSync(lockPath, "utf8"));
lock.version = version;
if (lock.packages?.[""]) lock.packages[""].version = version;
if (lock.packages?.["apps/desktop"]) lock.packages["apps/desktop"].version = version;
writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
console.log(`FungoCord atualizado para a versao ${version}.`);
