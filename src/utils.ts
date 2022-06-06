import axios from "axios";
import { GuildMember, TextChannel, ThreadChannel } from "discord.js";
import webhookManager from "./modules/utils/webhook_mgr";

const INVISIBLE_CHAR = "\u17B5";

async function postAsUser(
	channel: TextChannel | ThreadChannel,
	member: GuildMember,
	message: string,
	appendToName = ""
): Promise<boolean> {

	const appendedName = member.displayName + appendToName;
	const userNamePadded = appendedName.padEnd(
		member.displayName.length + 1,
		INVISIBLE_CHAR
	);

	const isThread = channel.isThread();
	const parentChannel = isThread ? channel.parent : channel;
	if (!parentChannel) {
		return false;
	}

	const webhook = await webhookManager.getWebhookForChannel(parentChannel);
	if (!webhook) {
		return false;
	}

	try {
		await webhook.send({
			username: userNamePadded,
			content: message,
			avatarURL: member.user.avatarURL() || member.user.defaultAvatarURL,
			threadId: isThread ? channel.id : undefined,
		});
		return true;
	} catch (e) {
		console.error(e);
		return false;
	}
}

const pad = (n: string | number, z = 2) => ('00' + n).slice(-z);

const fmtTime = (miliseconds: number) => {

	const hours = miliseconds / 3.6e6 | 0;
	const minutes = (miliseconds % 3.6e6) / 6e4 | 0;
	const seconds = (miliseconds % 6e4) / 1000 | 0;
	const mils = (miliseconds % 1000);

	let str = '';

	if (hours) {
		str += `${hours}h `;
	}

	if (minutes) {
		str += `${minutes}m `;
	}

	if (seconds) {
		str += `${seconds}.${pad(mils, 3)}s`;
	}

	return str;
}

async function getGeodataForLocation(location: string) {
	if (!process.env.NBOT_OPENCAGE_API_KEY) {
		return null;
	}

	// https://opencagedata.com/api#request
	const openCageResp = await axios.get(
		"https://api.opencagedata.com/geocode/v1/json",
		{
			params: {
				key: process.env.NBOT_OPENCAGE_API_KEY,
				q: location,
				abbrv: 1,
				limit: 1,
				no_record: 1, // :D
			},
		}
	);

	if (openCageResp.status !== 200) {
		return null;
	}

	return openCageResp.data;
}

const isBotOwner = (userId: string) => {

	if (!process.env.NBOT_OWNER_ID) {
		return false;
	}

	return process.env.NBOT_OWNER_ID === userId;
}

export { postAsUser, getGeodataForLocation, INVISIBLE_CHAR, isBotOwner, fmtTime };
