import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";

const PAYLOADS_DIR = join(__dirname, "payloads");

export function savePayload(name: string, data: unknown): string {
  const path = join(PAYLOADS_DIR, `${name}.json`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
  return path;
}
