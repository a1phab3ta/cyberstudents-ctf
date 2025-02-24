import { ChatInputCommand } from "@sapphire/framework";
import { Subcommand } from "@sapphire/plugin-subcommands";

import { handleChallengeWizard } from "../../functions/create/challengeWizard.js";
import { challengeCache, prisma } from "../../index.js";

export class BlacklistChatInputCommand extends Subcommand {
  public constructor(context: Subcommand.LoaderContext, options: Subcommand.Options) {
    super(context, {
      ...options,
      name: "challenge",
      description: "Create or edit a challenge",
      subcommands: [
        { name: "create", chatInputRun: "chatInputCreate" },
        { name: "edit", chatInputRun: "chatInputEdit" },
      ],
    });
  }

  public override registerApplicationCommands(registry: ChatInputCommand.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder //
          .setName(this.name)
          .setDescription(this.description)
          .setDefaultMemberPermissions("0")
          .addSubcommand((command) => command.setName("create").setDescription("Create a challenge"))
          .addSubcommand((command) =>
            command
              .setName("edit")
              .setDescription("Edit an existing challenge or draft")
              .addStringOption((command) =>
                command
                  .setName("challenge")
                  .setDescription("Continue from a challenge or draft")
                  .setAutocomplete(true)
                  .setRequired(true),
              ),
          ),
      {
        idHints: [],
      },
    );
  }

  public async autocompleteRun(interaction: Subcommand.AutocompleteInteraction<"cached">) {
    const value = interaction.options.getFocused();

    const challenges = challengeCache.filter(
      (c) => c.title.toLowerCase().includes(value.toLowerCase()) || value.startsWith(`${c.id}`),
    );

    return await interaction.respond(challenges.map((c) => ({ name: `#${c.id} - ${c.title}`, value: `${c.id}` })));
  }

  public async chatInputCreate(interaction: Subcommand.ChatInputCommandInteraction<"cached">) {
    // Create entry for the author if it doesn't exist
    await prisma.challengeAuthor.upsert({
      where: { id: interaction.user.id },
      create: { id: interaction.user.id },
      update: {},
    });

    await handleChallengeWizard(
      { title: "", category: "", points: 0, flags: [], description: "", files: [], published: false, archived: false },
      interaction,
    );
  }

  public async chatInputEdit(interaction: Subcommand.ChatInputCommandInteraction<"cached">) {
    const challengeId = interaction.options.getString("challenge", true);

    // Create entry for the author if it doesn't exist
    await prisma.challengeAuthor.upsert({
      where: { id: interaction.user.id },
      create: { id: interaction.user.id },
      update: {},
    });

    const existingChallenge = await prisma.challenge.findUnique({ where: { id: parseInt(challengeId) || -1 } });

    if (!existingChallenge) {
      return await interaction.reply({ content: `Challenge \`${challengeId}\` doesn't exist.`, ephemeral: true });
    }

    return await handleChallengeWizard(existingChallenge, interaction, existingChallenge.id);
  }
}
