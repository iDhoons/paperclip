import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import { PLUGIN_ID, PLUGIN_VERSION, WEBHOOK_KEYS } from "./constants.js";

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Discord",
  description:
    "Discord integration — /bug slash command for issue creation, notifications, and agent status.",
  author: "Paperclip",
  categories: ["connector", "automation"],
  capabilities: [
    "companies.read",
    "projects.read",
    "issues.read",
    "issues.create",
    "issues.update",
    "issue.comments.read",
    "issue.comments.create",
    "agents.read",
    "events.subscribe",
    "webhooks.receive",
    "http.outbound",
    "secrets.read-ref",
    "plugin.state.read",
    "plugin.state.write",
    "activity.log.write",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      discordBotTokenRef: {
        type: "string",
        title: "Discord Bot Token (Secret Reference)",
        description: "Secret reference for the Discord bot token",
      },
      defaultGuildId: {
        type: "string",
        title: "Discord Server (Guild) ID",
      },
      defaultChannelId: {
        type: "string",
        title: "Default Notification Channel ID",
      },
      notifyOnIssueCreated: {
        type: "boolean",
        title: "Notify on Issue Created",
        default: true,
      },
      notifyOnIssueDone: {
        type: "boolean",
        title: "Notify on Issue Done",
        default: true,
      },
    },
    required: ["discordBotTokenRef", "defaultGuildId"],
  },
  webhooks: [
    {
      endpointKey: WEBHOOK_KEYS.interactions,
      displayName: "Discord Interactions",
      description:
        "Receives Discord slash command and button interaction payloads.",
    },
  ],
  jobs: [],
  tools: [],
};

export default manifest;
