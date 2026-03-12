import type { App } from "@slack/bolt";
import { gorkMessageCallback } from "./gork-message";

const register = (app: App) => {
  app.event("app_mention", gorkMessageCallback);
};

export default { register };
