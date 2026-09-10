import { readFileSync, writeFileSync } from "node:fs";

const id = process.env.DATABASE_ID;
if (!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id ?? "")) {
  throw new Error("Set CLOUDFLARE_D1_DATABASE_ID to the shares database ID");
}
if (!/^[\w.-]+$/.test(process.env.APP_CLIENT_ID ?? "") || !/^[a-z\d-]+$/.test(process.env.VITE_GITHUB_APP_SLUG ?? "")) {
  throw new Error("Set APP_CLIENT_ID and APP_SLUG");
}
const path = new URL("../config/wrangler.jsonc", import.meta.url);
const config = JSON.parse(readFileSync(path, "utf8"));
config.d1_databases[0].database_id = id;
config.vars.GITHUB_CLIENT_ID = process.env.APP_CLIENT_ID;
writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
