import type { App } from "@slack/bolt";
import { chudMessageCallback } from "./chud-message";

const register = (app: App) => {
  app.event("app_mention", chudMessageCallback);
};

export default { register };