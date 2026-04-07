import {
  definePlugin,
  runWorker,
  type PluginContext,
  type PluginWebhookInput,
} from "@paperclipai/plugin-sdk";
import type { Project } from "@paperclipai/shared";
import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  REST,
  Routes,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
  type AutocompleteInteraction,
} from "discord.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DiscordConfig = {
  discordBotTokenRef: string;
  defaultGuildId: string;
  defaultChannelId?: string;
  notifyOnIssueCreated?: boolean;
  notifyOnIssueDone?: boolean;
};

type IssuePriority = "critical" | "high" | "medium" | "low";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let discordClient: Client | null = null;
let pluginCtx: PluginContext | null = null;
let companyId: string | null = null;
let projectCache: Project[] = [];

async function refreshProjects(ctx: PluginContext) {
  projectCache = await ctx.projects.list({ companyId: companyId! });
}

function findProject(query: string): Project | undefined {
  const q = query.toLowerCase().trim();
  if (!q) return undefined;
  // exact match first, then prefix, then includes
  return (
    projectCache.find((p) => p.name.toLowerCase() === q) ??
    projectCache.find((p) => p.name.toLowerCase().startsWith(q)) ??
    projectCache.find((p) => p.name.toLowerCase().includes(q))
  );
}

// ---------------------------------------------------------------------------
// Issue creation
// ---------------------------------------------------------------------------

const VALID_PRIORITIES = new Set<string>(["low", "medium", "high", "critical"]);

async function createAndAssignIssue(
  ctx: PluginContext,
  input: { title: string; description?: string; priority: IssuePriority; projectId?: string },
): Promise<{ identifier: string; assigned: boolean; projectName?: string }> {
  const cid = companyId!;
  const cleanTitle = input.title.trim().slice(0, 200);
  const issue = await ctx.issues.create({
    companyId: cid,
    projectId: input.projectId,
    title: cleanTitle,
    description: input.description?.trim(),
    priority: input.priority,
  });
  const projectName = input.projectId
    ? projectCache.find((p) => p.id === input.projectId)?.name
    : undefined;
  try {
    const updated = await ctx.issues.update(issue.id, { status: "in_progress" }, cid);
    return { identifier: updated.identifier!, assigned: !!updated.assigneeAgentId, projectName };
  } catch (err) {
    ctx.logger.warn("issue created but auto-assign failed", { issueId: issue.id, err: String(err) });
    return { identifier: issue.identifier!, assigned: false, projectName };
  }
}

// ---------------------------------------------------------------------------
// /issue — autocomplete (project name)
// ---------------------------------------------------------------------------

async function handleAutocomplete(interaction: AutocompleteInteraction) {
  const focused = interaction.options.getFocused(true);
  if (focused.name !== "project") return;

  const query = focused.value.toLowerCase();
  const matches = projectCache
    .filter((p) => !query || p.name.toLowerCase().includes(query))
    .slice(0, 25)
    .map((p) => ({ name: p.name, value: p.id }));

  await interaction.respond(matches);
}

// ---------------------------------------------------------------------------
// /issue — slash command
// ---------------------------------------------------------------------------

async function handleIssueCommand(interaction: ChatInputCommandInteraction) {
  const ctx = pluginCtx;
  if (!ctx || !companyId) {
    await interaction.reply({ content: "Plugin not ready", ephemeral: true });
    return;
  }

  const title = interaction.options.getString("title");
  const projectId = interaction.options.getString("project") ?? undefined;

  if (title) {
    await interaction.deferReply({ ephemeral: true });
    try {
      const result = await createAndAssignIssue(ctx, { title, priority: "medium", projectId });
      const assignee = result.assigned ? " (에이전트 배정됨)" : "";
      const proj = result.projectName ? ` [${result.projectName}]` : "";
      await interaction.editReply(
        `**${result.identifier}** 생성됨${proj}${assignee}\n> ${title.trim()}`,
      );
    } catch (err) {
      ctx.logger.error("failed to create issue from /issue", { err: String(err) });
      await interaction.editReply(`이슈 생성 실패: ${String(err)}`);
    }
    return;
  }

  // No title — show modal (store selected projectId in customId)
  const modalId = projectId ? `issue-modal:${projectId}` : "issue-modal:";

  const modal = new ModalBuilder()
    .setCustomId(modalId)
    .setTitle("이슈 등록");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("issue-title")
        .setLabel("제목")
        .setPlaceholder("로그인 화면 하얘짐 / 프로필 사진 업로드 추가")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(200),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("issue-description")
        .setLabel("설명 (선택)")
        .setPlaceholder("재현 방법, 원하는 동작, 참고 사항 등")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(2000),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("issue-priority")
        .setLabel("긴급도 (low / medium / high / critical)")
        .setPlaceholder("medium")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(10),
    ),
  );

  await interaction.showModal(modal);
}

// ---------------------------------------------------------------------------
// /issue — modal submit
// ---------------------------------------------------------------------------

async function handleIssueModal(interaction: ModalSubmitInteraction) {
  const ctx = pluginCtx;
  if (!ctx || !companyId) {
    await interaction.reply({ content: "Plugin not ready", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  // Extract projectId from customId ("issue-modal:{projectId}")
  const projectId = interaction.customId.split(":")[1] || undefined;

  const title = interaction.fields.getTextInputValue("issue-title");
  const description =
    interaction.fields.getTextInputValue("issue-description") || undefined;
  const rawPriority =
    interaction.fields.getTextInputValue("issue-priority")?.toLowerCase().trim() ||
    "medium";
  const priority: IssuePriority = VALID_PRIORITIES.has(rawPriority)
    ? (rawPriority as IssuePriority)
    : "medium";

  try {
    const result = await createAndAssignIssue(ctx, { title, description, priority, projectId });
    const assignee = result.assigned ? " (에이전트 배정됨)" : "";
    const proj = result.projectName ? ` [${result.projectName}]` : "";
    const descLine = description ? `\n> ${description.trim().slice(0, 100)}` : "";
    await interaction.editReply(
      `**${result.identifier}** 생성됨 [${priority}]${proj}${assignee}\n> ${title.trim()}${descLine}`,
    );
  } catch (err) {
    ctx.logger.error("failed to create issue from modal", { err: String(err) });
    await interaction.editReply(`이슈 생성 실패: ${String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// Register /issue slash command
// ---------------------------------------------------------------------------

async function registerSlashCommands(token: string, guildId: string) {
  const rest = new REST({ version: "10" }).setToken(token);

  const issueCommand = new SlashCommandBuilder()
    .setName("issue")
    .setDescription("이슈를 등록합니다 — 제목 입력 시 즉시 생성, 없으면 양식 표시")
    .addStringOption((opt) =>
      opt
        .setName("project")
        .setDescription("프로젝트 (입력하면 자동완성)")
        .setRequired(false)
        .setAutocomplete(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("title")
        .setDescription("이슈 제목 (생략하면 양식이 표시됩니다)")
        .setRequired(false),
    );

  const appInfo = (await rest.get(Routes.currentApplication())) as { id: string };

  await rest.put(Routes.applicationGuildCommands(appInfo.id, guildId), {
    body: [issueCommand.toJSON()],
  });

  return appInfo.id;
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

const plugin = definePlugin({
  async setup(ctx: PluginContext) {
    pluginCtx = ctx;
    ctx.logger.info("Discord plugin setup starting");

    const config = (await ctx.config.get()) as unknown as DiscordConfig;
    if (!config.discordBotTokenRef) {
      ctx.logger.warn("No discordBotTokenRef configured — skipping Discord bot");
      return;
    }

    const token = await ctx.secrets.resolve(config.discordBotTokenRef);
    if (!token) {
      ctx.logger.error("Failed to resolve Discord bot token secret");
      return;
    }

    const companies = await ctx.companies.list();
    if (companies.length === 0) {
      ctx.logger.error("No companies found — cannot create issues");
      return;
    }
    companyId = companies[0]!.id;

    // Cache projects for autocomplete
    await refreshProjects(ctx);
    ctx.logger.info("projects cached", { count: projectCache.length });

    try {
      const appId = await registerSlashCommands(token, config.defaultGuildId);
      ctx.logger.info("slash commands registered", { appId, guildId: config.defaultGuildId });
    } catch (err) {
      ctx.logger.error("failed to register slash commands", { err: String(err) });
    }

    const client = new Client({ intents: [GatewayIntentBits.Guilds] });

    client.on("ready", () => {
      ctx.logger.info("Discord bot connected", { user: client.user?.tag });
    });

    client.on("interactionCreate", async (interaction) => {
      try {
        if (interaction.isAutocomplete() && interaction.commandName === "issue") {
          await handleAutocomplete(interaction);
          return;
        }
        if (interaction.isChatInputCommand() && interaction.commandName === "issue") {
          await handleIssueCommand(interaction);
          return;
        }
        if (interaction.isModalSubmit() && interaction.customId.startsWith("issue-modal:")) {
          await handleIssueModal(interaction);
          return;
        }
      } catch (err) {
        ctx.logger.error("interaction handler error", { err: String(err) });
      }
    });

    await client.login(token);
    discordClient = client;

    // Refresh project cache periodically (every 5 min)
    setInterval(() => {
      refreshProjects(ctx).catch((err) =>
        ctx.logger.warn("project cache refresh failed", { err: String(err) }),
      );
    }, 5 * 60 * 1000);

    // Notifications
    if (config.notifyOnIssueCreated && config.defaultChannelId) {
      ctx.events.on("issue.created", async (event) => {
        const payload = event.payload as { title?: string; identifier?: string };
        try {
          const channel = await client.channels.fetch(config.defaultChannelId!);
          if (channel?.isTextBased() && "send" in channel) {
            await channel.send(`새 이슈: **${payload.identifier ?? ""}** ${payload.title ?? ""}`);
          }
        } catch { /* ignore */ }
      });
    }

    if (config.notifyOnIssueDone && config.defaultChannelId) {
      ctx.events.on("issue.updated", async (event) => {
        const payload = event.payload as { title?: string; identifier?: string; status?: string };
        if (payload.status !== "done") return;
        try {
          const channel = await client.channels.fetch(config.defaultChannelId!);
          if (channel?.isTextBased() && "send" in channel) {
            await channel.send(`이슈 완료: **${payload.identifier ?? ""}** ${payload.title ?? ""}`);
          }
        } catch { /* ignore */ }
      });
    }

    ctx.logger.info("Discord plugin setup complete");
  },

  async onHealth() {
    const connected = discordClient?.isReady() ?? false;
    return {
      status: connected ? "ok" : "degraded",
      message: connected
        ? `Connected as ${discordClient!.user?.tag}`
        : "Discord client not connected",
    };
  },

  async onWebhook(_input: PluginWebhookInput) {
    pluginCtx?.logger.info("webhook received (Gateway mode — ignored)");
  },

  async onShutdown() {
    if (discordClient) {
      discordClient.destroy();
      discordClient = null;
    }
    pluginCtx?.logger.info("Discord plugin shutdown");
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
