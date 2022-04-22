import { Message, MessageEmbed, TextChannel, ThreadChannel } from "discord.js";
import config from "../config";
import { DatabaseModule } from "../module_mgr";

class PatchBotAdBlock extends DatabaseModule {

	

	async handleMessage(message: Message) {
		if (
			!message.author.bot ||
			message.author.username !== "PatchBot" ||
			message.embeds.length === 0
		) {
			return;
		}

		if (!this.isEnabled(message.guildId)) {
			return;
		}

		const repostEmbeds: MessageEmbed[] = [];

		message.embeds.forEach((embed) => {
			if (
				!embed.author ||
				embed.author.name.indexOf(
					"This update is brought to you by"
				) === -1
			) {
				repostEmbeds.push(embed);
			}
		});

		let channel = message.channel;

		if (repostEmbeds.length > 0) {
			const gameName = repostEmbeds[0].author?.name;
			if (gameName) {
				const redirects: { [key: string]: string } = config.patchbot_redirects;
				const redirectId = redirects[gameName];

				if (redirectId) {
					const foundChannel = message.client.channels.cache.get(redirectId);
					if (foundChannel instanceof TextChannel || foundChannel instanceof ThreadChannel) {
						channel = foundChannel;
					}
				}
			}
		}

		await channel.send({
			embeds: repostEmbeds
		});

		await message.delete();
	}
}

const adblock = new PatchBotAdBlock('patchbot-adblock', 'Blocks PatchBot\'s adverts and redirects updates to the correct channel');

export default adblock;
