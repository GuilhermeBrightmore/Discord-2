import { serve } from "@hono/node-server";
import { makeApp, readEnv } from "@discord2/server-core";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), "../../.env.local") });
const env = readEnv();
serve({ fetch: makeApp().fetch, hostname: "0.0.0.0", port: env.PORT }, (info) => {
  console.log(`FungoCord API ouvindo em http://0.0.0.0:${info.port}`);
});
