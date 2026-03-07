import type { App } from "@slack/bolt";
import { chudMessageCallback } from "./chud-message";

const register = (app: App) => {
  app.message(/ping/i, chudMessageCallback);
};

export default { register };