import { handleShareRequest, type ShareEnv } from "./src/server/shares";

export default {
  fetch: handleShareRequest,
  async scheduled(_event: unknown, env: ShareEnv) {
    await env.DB.prepare("DELETE FROM shares WHERE expires_at <= ?").bind(Date.now()).run();
    await env.DB.prepare("DELETE FROM authorizations WHERE expires_at <= ?").bind(Date.now()).run();
  },
};
