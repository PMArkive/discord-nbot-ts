import {
	Client,
	ChatInputCommandInteraction,
	TextChannel,
	ThreadChannel,
} from "discord.js";
import config from "../config";
import { DatabaseModule } from "../module_mgr";

class Permathreader extends DatabaseModule {
	isPermathread(thread: ThreadChannel) {
		return config.permathreads.includes(thread.id);
	}

	async recoverFromSleep(client: Client) {
		console.log(`Recovering permathreads...`);
		if (client == null || config.permathreads.length <= 0) {
			console.log("Nothing to recover is there");
			return;
		}

		for (const [, guild] of client.guilds.cache) {
			for (const [, channel] of guild.channels.cache) {
				if (!(channel instanceof TextChannel)) {
					continue;
				}

				try {
					const fetched = await channel.threads.fetchArchived();
					for (const [, thread] of fetched.threads) {
						if (thread.archived && this.isPermathread(thread)) {
							console.log(`Recovered permathread ${thread.name}`);
							await thread.setArchived(false);
						}
					}
				}
				catch (e) {
					console.log(`Permathreads, ignoring: ${e}`);
				}
			}
		}
	}

	async handleThreadUpdate(newThread: ThreadChannel) {
		if (newThread.archived && this.isPermathread(newThread)) {
			console.log(`Preventing ${newThread.name} from archiving`);
			await newThread.setArchived(false);
		}
	}

	async handleInteraction(interaction: ChatInputCommandInteraction) {
		const threadName = interaction.options.getString("name");
		if (!threadName) {
			interaction.reply("Must specify thread name");
			return;
		}

		if (interaction.channel instanceof TextChannel) {
			try {
				const thread = await interaction.channel.threads.create({
					name: threadName,
					autoArchiveDuration: 1440,
					reason: threadName,
				});

				config.permathreads.concat(thread.id);
				await interaction.reply("Created permathread");
			} catch (e) {
				await interaction.reply(`Failed to create permathread: ${e}`);
			}
		}
	}
}

const permathreader = new Permathreader('permathreads', 'Creation of threads that never expire');

export default permathreader;
