import { readFileSync, writeFileSync } from "node:fs";

const id = process.env.DATABASE_ID;
if (!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id ?? "")) {
  throw new Error("Set CLOUDFLARE_D1_DATABASE_ID to the shares database ID");
}
if (!/^[\w.-]+$/.test(process.env.APP_CLIENT_ID ?? "") || !/^[a-z\d-]+$/.test(process.env.VITE_GITHUB_APP_SLUG ?? "")) {
  throw new Error("Set APP_CLIENT_ID and APP_SLUG");
}
const path = new URL("../config/wrangler.toml", import.meta.url);
const config = readFileSync(path, "utf8");
if (!/^database_id = ".*"$/m.test(config) || !/^GITHUB_CLIENT_ID = ".*"$/m.test(config)) {
  throw new Error("Wrangler TOML is missing deployment fields");
}
const deployed = config
  .replace(/^database_id = ".*"$/m, `database_id = "${id}"`)
  .replace(/^GITHUB_CLIENT_ID = ".*"$/m, `GITHUB_CLIENT_ID = "${process.env.APP_CLIENT_ID}"`);
writeFileSync(path, deployed);
