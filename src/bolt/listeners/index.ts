import type { App } from "@slack/bolt";
import messages from "./messages";
import { assistant } from "./assistant";

const registerListeners = (app: App) => {
  app.assistant(assistant);
  messages.register(app);
};

export default registerListeners;