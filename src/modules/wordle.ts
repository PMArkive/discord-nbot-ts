import { userMention } from "@discordjs/builders";
import { CommandInteraction, Message, MessageEmbed, TextChannel } from "discord.js";
import sharp from "sharp";
import { DatabaseModule } from "../module_mgr";
import { getMongoDatabase } from "../mongodb";

const MIN_WINNER_WORD_RARITY = 1_000_000;
const MIN_GUESS_WORD_RARITY = 150_000;
// const MIN_WINNER_WORD_RARITY = 200;
// const MIN_GUESS_WORD_RARITY = 100;

const MAX_ATTEMPTS = 6;

const BOARD_TILE_GAP = 4;

const BOARD_TILE_HEIGHT = 32;
const BOARD_TILE_WIDTH = 32;

const KB_BUTTON_HEIGHT = 20;
const KB_BUTTON_WIDTH = 20;

enum WordValidateResult {
	Valid,
	Invalid,
	TooRecent,
	BadLength,
	AlreadyGuessed
}

enum GuessStatus {
	Unknown,
	Absent,
	Present,
	Correct
}


const colors = new Map<GuessStatus, string>();
colors.set(GuessStatus.Unknown, "#42464D");
colors.set(GuessStatus.Correct, "#15803D");
colors.set(GuessStatus.Present, "#A16207");
colors.set(GuessStatus.Absent, "#202225");

interface Guess {
	letter: string;
	status: GuessStatus;
}
const keyboard: Array<Array<string>> = [
	["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
	["a", "s", "d", "f", "g", "h", "j", "k", "l"],
	["z", "x", "c", "v", "b", "n", "m"]
]

// const KB_MAX_WIDTH = Math.max(...keyboard.map(row => row.length)) * KB_BUTTON_WIDTH;
// const KB_MAX_LENGTH = keyboard.length * KB_BUTTON_HEIGHT;

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


class WordleManager extends DatabaseModule {
	games: Array<Wordle> = [];

	async handleMessage(message: Message): Promise<boolean> {

		if (!this.isEnabled(message.guildId)) {
			return false;
		}

		if (!message.content.startsWith(">")) {
			return false;
		}

		// find game where channel is the same
		const game = this.games.find(g => g.channel?.id === message.channel.id);
		if (game) {
			const continueGame = await game.doGuess(message);
			if (!continueGame) {
				this.games = this.games.filter(g => g !== game);
			}
		}

		return true;
	}

	async commandWordle(interaction: CommandInteraction): Promise<boolean> {

		if (!this.isEnabled(interaction.guildId)) {
			await interaction.reply("This command is disabled in this server.");
			return false;
		}

		const game = this.games.find(g => g.channel?.id === interaction.channel?.id);
		if (game) {
			await game.displayGraphics(interaction);
			return false;
		}

		const wordle = new Wordle();
		await wordle.beginGame(interaction);
		this.games.push(wordle);
		return true;
	}

	async commandStats(interaction: CommandInteraction): Promise<void> {

		if (!this.isEnabled(interaction.guildId)) {
			await interaction.reply("This command is disabled in this server.");
			return;
		}

		const statsType = interaction.options.getString("type");
		if (!statsType) {
			await interaction.reply(`You must specify a type`);
			return;
		}

		switch (statsType) {
			case "fastest": {
				await this.commandByTime(interaction, true);
				break;
			}
			case "lost_words": {
				await this.commandLost(interaction);
				break;
			}
			case "slowest": {
				await this.commandByTime(interaction, false);
				break;
			}
			case "longest_words": {
				await this.commandLongestWords(interaction);
				break;
			}
		}
	}

	async commandLost(interaction: CommandInteraction): Promise<void> {

		const wordleCollection = getMongoDatabase()?.collection("wordle");
		if (wordleCollection === undefined) {
			await interaction.reply("No games played yet");
			return;
		}

		const lostGames = await wordleCollection.find({
			won: false,
			guild: interaction.guildId
		}).toArray();

		if (lostGames.length === 0) {
			await interaction.reply("No games lost yet, good job");
			return;
		}

		const lostGamesEmbed = new MessageEmbed();

		// create a comma separated list of 'winner_word' in lostGames
		const lostGamesList = lostGames.map(g => `\`${g.word}\``).join(` `);

		lostGamesEmbed.setTitle(`Lost games: ${lostGames.length}`);
		lostGamesEmbed.setDescription(`${lostGamesList}`);
		lostGamesEmbed.setColor("#ff0000");

		await interaction.reply({ embeds: [lostGamesEmbed] });
	}

	async commandLongestWords(interaction: CommandInteraction): Promise<void> {

		const wordleCollection = getMongoDatabase()?.collection("wordle");
		if (wordleCollection === undefined) {
			await interaction.reply("Can't access stats right now");
			return;
		}

		const longestWords = await wordleCollection.aggregate([
			{ $match: { won: true } },
			{
				$project: {
					"word": 1,
					"players": 1,
					"word_length": { $strLenCP: "$word" }
				}
			},
			{ $sort: { "word_length": -1 } },
			{ $project: { "word_length": 0 } },
			{ $limit: 10 }
		]).toArray();


		if (longestWords.length === 0) {
			await interaction.reply("No games played yet");
			return;
		}

		const embed = new MessageEmbed();

		embed.setTitle("Longest words guessed");
		embed.setColor("#6aaa64");

		let content = ''
		for (let i = 0; i < longestWords.length; i++) {
			const game = longestWords[i];

			// remove repeated entries from game.players
			game.players = [...new Set(game.players)];

			content += `${i + 1}. **${game.word}** in ${fmtTime(game.elapsed)} by `;
			// TODO: Remove repeated players from here
			game.players.map(((player: string) => {
				content += `${userMention(player)} `;
			}));

			content += '\n';
		}

		embed.setDescription(content);

		await interaction.reply({ embeds: [embed] });
	}

	async commandByTime(interaction: CommandInteraction, sortByLowest: boolean): Promise<void> {

		const wordleCollection = getMongoDatabase()?.collection("wordle");
		if (wordleCollection === undefined) {
			await interaction.reply("No games played yet");
			return;
		}

		// get the top 10 games with the lowest 'elapsed' time
		const topGames = await wordleCollection
			.find({ elapsed: { $exists: true } })
			.sort({ elapsed: sortByLowest ? 1 : -1 }).limit(10).toArray();

		const embed = new MessageEmbed();
		embed.setTitle(`${sortByLowest ? "Fastest" : "Slowest"} wordle games`);

		let content = '';

		for (let i = 0; i < topGames.length; i++) {
			const game = topGames[i];

			// remove repeated entries from game.players
			game.players = [...new Set(game.players)];

			content += `${i + 1}. **${game.word}** in ${fmtTime(game.elapsed)} by `;
			// TODO: Remove repeated players from here
			game.players.map(((player: string) => {
				content += `${userMention(player)} `;
			}));

			content += '\n';
		}

		embed.setDescription(content);

		// Lil easter egg for my guild, picture of undercoverdudes
		if (interaction.guildId === "336213135193145344" || interaction.guildId === "937552002991403132") {
			embed.setThumbnail("https://i.imgur.com/V6iGmQW.png");
		}

		await interaction.reply({
			embeds: [embed]
		});
	}
}

interface DbGame {
	word: string,
	guesses: number,
	players: Array<string>,
	date: Date,
	won: boolean,
	guild: string
	elapsed: number
}

interface GuildStats {
	totalPlayed: number;
	totalWon: number;
	guessDist: Array<number>;
	maxWinStreak: number;
	currentWinStreak: number;
	bestTime: number;
}

class Wordle {
	lastGuessTime: Date | null;
	guesses: Array<Array<Guess>>;
	playerHistory: Array<string>;
	winnerWord: string;
	channel: TextChannel | null;
	keyboardColors: Map<string, GuessStatus>;
	numAttempts: number;
	won: boolean;
	startTime: Date;


	constructor() {
		this.startTime = new Date();
		this.lastGuessTime = null;
		this.channel = null;
		this.numAttempts = 0;
		this.winnerWord = '';
		this.guesses = [];
		this.playerHistory = [];
		this.keyboardColors = new Map();
		this.won = false;
	}

	async beginGame(interaction: CommandInteraction): Promise<void> {

		let wantedLen = interaction.options.getInteger('length');
		if (wantedLen === null) {
			wantedLen = 5;
		} else if (wantedLen < 4 || wantedLen > 10) {
			await interaction.reply(`Word length must be between 4 and 10 characters.`);
			return;
		}

		this.channel = interaction.channel as TextChannel;
		await this.generateRandomWord(wantedLen);

		if (this.winnerWord === '') {
			await interaction.reply('No words found with that length. Try again.');
			return;
		}

		console.log("Starting a new game of wordle with word " + this.winnerWord);

		const sent = await interaction.reply({
			files: await this.getAttachments(),
			content: "A new game of wordle has started!",
			fetchReply: true
		});

		if (sent) {
			this.startTime = new Date();
		}
	}

	async getAttachments() {
		return [
			{
				attachment: await this.buildBoardSvg(),
				name: 'board.png'
			},
			{
				attachment: await this.createPreviewKeyboard(),
				name: 'wordle_keyboard.png'
			}
		];
	}

	async validateWord(word: string): Promise<WordValidateResult> {

		if (word.length != this.winnerWord?.length) {
			//console.log(`Word ${word} is not the same length as the winner word`);
			return WordValidateResult.BadLength;
		}

		for (let i = 0; i < this.guesses.length; i++) {
			const prevWord = this.guesses[i].map(g => g.letter).join('');
			if (word === prevWord) {
				return WordValidateResult.AlreadyGuessed;
			}
		}

		// Check that the word wasn't guessed recently
		if (this.numAttempts === 0) {
			const isOriginal = await this.isOriginalWord(word);
			if (!isOriginal) {
				return WordValidateResult.TooRecent;
			}
		}

		// Check that the word exists
		const collection = getMongoDatabase()?.collection('dictionary');
		if (collection) {
			const entry = await collection?.findOne(
				{
					w: word,
					f: { $gt: MIN_GUESS_WORD_RARITY }
				}
			);
			if (entry === null) {
				return WordValidateResult.Invalid;
			}
		}


		return WordValidateResult.Valid;
	}

	// Protection against people using the same starter words
	async isOriginalWord(word: string): Promise<boolean> {

		const recentWords = getMongoDatabase()?.collection('wordle.recent');
		const result = await recentWords?.updateOne({
			w: word,
			d: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
			g: this.channel?.guild.id
		}, { $set: { w: word, d: new Date(), g: this.channel?.guild.id } }, { upsert: true });

		if (result?.upsertedCount) {
			//console.log(`New word ${word} added to recent words`);
			return true;
		} else {
			//console.log(`Word ${word} already exists in recent words`);
			return false;
		}
	}

	async saveToDb(elapsed: number) {
		const db = getMongoDatabase();
		if (!db || !this.channel) {
			return;
		}

		const collection = db.collection('wordle');

		const game: DbGame = {
			word: this.winnerWord,
			guesses: this.numAttempts,
			players: this.playerHistory,
			date: new Date(),
			won: this.won,
			guild: this.channel.guild.id,
			elapsed: elapsed
		}

		await collection.insertOne(game);
	}

	async getStatsForGuild(guildId: string): Promise<GuildStats | null> {
		const db = getMongoDatabase();
		if (!db) {
			return null;
		}

		const collection = db.collection('wordle');
		let entries = await collection.find({ guild: guildId }).toArray();

		entries = entries.sort((a, b) => {
			if (a.date < b.date) {
				return -1;
			}
			if (a.date > b.date) {
				return 1;
			}
			return 0;
		});

		let newestStreak = 0;
		let currentStreak = 0;
		let longestStreak = 0;
		let resetOnce = false;

		// iterate entries backwards
		for (let i = entries.length - 1; i >= 0; i--) {
			if (entries[i].won) {
				currentStreak++;

				if (currentStreak > longestStreak) {
					longestStreak = currentStreak;
				}

				if (!resetOnce) {
					newestStreak = currentStreak;
				}

			} else {
				currentStreak = 0;
				resetOnce = true;
			}
		}

		if (!resetOnce) {
			newestStreak = currentStreak;
		}

		const numAttempts = new Array(MAX_ATTEMPTS).fill(0);
		// fill in the array with the number of attempts
		for (let i = 0; i < entries.length; i++) {
			const guessIndex = entries[i].guesses - 1;
			numAttempts[guessIndex]++;
			//console.log(`in ${entries[i].guesses} attempts: ${numAttempts[entries[i].guesses]}`);
		}

		// find entry with lowest 'bt'
		let bestTime = Infinity;
		for (let i = 0; i < entries.length; i++) {
			if (entries[i].won && entries[i].elapsed < bestTime) {
				bestTime = entries[i].elapsed;
			}
		}


		const numPlayed = entries.length;
		const numWon = entries.filter(e => e.won).length;

		const stats = {
			totalPlayed: numPlayed,
			totalWon: numWon,
			guessDist: numAttempts,
			maxWinStreak: longestStreak,
			currentWinStreak: newestStreak,
			bestTime: bestTime
		}

		//console.log(stats);
		return stats;
	}

	async doGuess(message: Message): Promise<boolean> {
		const guess = message.content.substring(1).toLowerCase();

		const validResult = await this.validateWord(guess);

		switch (validResult) {
			case WordValidateResult.AlreadyGuessed: {
				await message.reply("❌ You've already guessed that word");
				return true;
			}
			case WordValidateResult.TooRecent: {
				await message.reply("❌ You've recently started a game with that word");
				return true;
			}
			case WordValidateResult.BadLength:
			case WordValidateResult.Invalid: {
				await message.react('❌');
				return true;
			}
			case WordValidateResult.Valid: {

				// apply cooldown if someone else guessed a word less than 3 seconds ago
				// this is to avoid accidental guesses when the result has been updated
				const lastPlayerId = this.playerHistory[this.playerHistory.length - 1];
				if (lastPlayerId !== message.member?.id) {
					// if less than 3 seconds have passed since the last guess, don't allow it
					const curTime = new Date();
					if (this.lastGuessTime && curTime.getTime() - this.lastGuessTime.getTime() < 3000) {
						await message.react('⏱');
						return true;
					}

					this.lastGuessTime = curTime;
				}
			}
		}

		// TODO: disallow if we've already guessed this word

		this.playerHistory.push(message.author.id);

		const maxlen = this.winnerWord.length;

		const lineGuess = new Array(maxlen);

		for (let i = 0; i < maxlen; i++) {
			lineGuess[i] = { letter: guess[i], status: GuessStatus.Unknown };
		}

		const guessArr = guess.split('');
		const filteredWord = this.winnerWord.split('');

		// Find all full matches
		for (let i = 0; i < maxlen; i++) {
			if (filteredWord[i] === guessArr[i]) {
				guessArr[i] = '\0';
				filteredWord[i] = '\0';
				lineGuess[i].status = GuessStatus.Correct;
				this.updateKeyboard(lineGuess[i]);
			}
		}

		// Find all partial matches
		for (let i = 0; i < maxlen; i++) {
			if (filteredWord[i] === '\0' || guessArr[i] === '\0') {
				continue;
			}

			if (filteredWord.includes(guessArr[i])) {
				lineGuess[i].status = GuessStatus.Present;
				this.updateKeyboard(lineGuess[i]);
			} else {
				lineGuess[i].status = GuessStatus.Absent;
				this.updateKeyboard(lineGuess[i]);
			}
		}

		this.guesses.push(lineGuess);
		this.numAttempts++;

		await this.displayGraphics(message);

		let description = '';

		let continueGame = true;
		if (guess === this.winnerWord) {
			this.won = true;
			continueGame = false;
		} else if (this.numAttempts >= MAX_ATTEMPTS) {
			description = `The word was \`${this.winnerWord}\``;
			continueGame = false;
		}

		if (!continueGame && this.channel) {
			const elapsed = new Date().getTime() - this.startTime.getTime();
			await this.saveToDb(elapsed);
			await this.printStats(elapsed, this.won, description);
		}

		return continueGame;
	}

	async displayGraphics(message: Message | CommandInteraction) {

		await message.channel?.send({
			files: await this.getAttachments()
		})
	}

	async printStats(elapsed: number, didWin: boolean, description: string) {

		if (!this.channel) {
			return;
		}

		const stats = await this.getStatsForGuild(this.channel.guild.id);
		if (!stats) {
			return;
		}

		let bestGuess = -1;
		for (let i = 0; i < stats.guessDist.length; i++) {
			if (stats.guessDist[i] > 0) {
				bestGuess = i + 1;
				break;
			}
		}

		let totalGuesses = 0;
		for (let i = 0; i < stats.guessDist.length; i++) {
			totalGuesses += stats.guessDist[i] * (i + 1);
		}

		//const guessDist = `1st: ${stats.guessDist[0]} | 2nd: ${stats.guessDist[1]} | 3rd: ${stats.guessDist[2]} | 4th: ${stats.guessDist[3]} | 5th: ${stats.guessDist[4]} | 6th: ${stats.guessDist[5]}`;

		const avgGuessAmt = totalGuesses / stats.totalPlayed;
		const winPct = (stats.totalWon / stats.totalPlayed * 100).toFixed(2);

		const embed = new MessageEmbed();

		if (this.won) {
			embed.setTitle('You won!');
			embed.setColor('#006843');
		} else {
			embed.setTitle('You lost!');
			embed.setColor('#ff0000');
		}

		// get the elapsed time 
		description += `\n\n**Elapsed**: \`${fmtTime(elapsed)}\` (Best: \`${fmtTime(stats.bestTime)}\`)`;
		if (elapsed == stats.bestTime) {
			description += ' 🏅';
		}

		description += `\n**Winrate**: \`${winPct}%\` (\`${stats.totalWon}/${stats.totalPlayed}\`)`;
		description += `\n**Avg. Guesses**: \`${avgGuessAmt.toFixed(1)}\` (Best: \`${bestGuess}\`)`;

		description += `\n**Streak**: \`${stats.currentWinStreak}\` (Best: \`${stats.maxWinStreak}\`)`;
		if (stats.currentWinStreak == stats.maxWinStreak) {
			description += ' 🏅';
		}

		embed.setDescription(description);

		await this.channel.send({
			embeds: [embed]
		});
	}

	async generateRandomWord(length: number) {

		const db = getMongoDatabase();
		if (!db) {
			return;
		}

		const collection = db.collection('dictionary');
		const entry = await collection.aggregate([
			{
				$match: {
					l: length,
					f: { $gt: MIN_WINNER_WORD_RARITY }
				}
			},
			{ $sample: { size: 1 } }
		]).toArray();

		if (entry.length === 0) {
			return;
		}
		this.winnerWord = entry[0]['w'];
	}

	updateKeyboard(guess: Guess) {
		const curStatus = this.keyboardColors.get(guess.letter);
		if (!curStatus || guess.status > curStatus) {
			this.keyboardColors.set(guess.letter, guess.status);
		}
	}

	async createPreviewKeyboard() {

		let maxWidth = 0;
		let svgContent = '<svg>';

		keyboard.forEach((row, rowIndex) => {

			const rowWidth = row.length * KB_BUTTON_WIDTH + (row.length - 1) * BOARD_TILE_GAP;
			if (rowWidth > maxWidth) {
				maxWidth = rowWidth;
			}

			//const rowWidth = row.length * KB_BUTTON_WIDTH + (row.length - 1) * BOARD_TILE_GAP;
			// offset from maxWidth to center the row
			//const rowX = (KB_MAX_WIDTH - rowWidth) / 2;

			row.forEach((key, keyIndex) => {
				const x = keyIndex * (KB_BUTTON_WIDTH + BOARD_TILE_GAP);
				const y = rowIndex * (KB_BUTTON_HEIGHT + BOARD_TILE_GAP);

				//console.log(`Requesting color for ${key}`);
				const guessStatus = this.keyboardColors.get(key) || GuessStatus.Unknown;

				const color = colors.get(guessStatus);
				svgContent += `
          <rect x="${x}" y="${y}" width="${KB_BUTTON_WIDTH}" height="${KB_BUTTON_HEIGHT}" fill="${color}" />
          <text 
            x="${x + KB_BUTTON_WIDTH / 2}" 
            y="${y + KB_BUTTON_HEIGHT / 2 + 4.5}" 
            font-family="Arial"
            font-weight="bold"
            text-anchor="middle" 
            fill="white">
            ${key.toUpperCase()}
          </text>
        `;
			}
			);
		});

		svgContent += '</svg>';

		const buffer = await sharp(Buffer.from(svgContent)).png().toBuffer();
		return buffer;
	}

	async buildBoardSvg() {

		if (this.winnerWord === null) {
			throw new Error('No winner word');
		}

		const wordLen = this.winnerWord.length;

		const width = this.winnerWord.length * BOARD_TILE_WIDTH + (wordLen - 1) * BOARD_TILE_GAP;
		const height = MAX_ATTEMPTS * BOARD_TILE_HEIGHT + (MAX_ATTEMPTS - 1) * BOARD_TILE_GAP;

		let svgContent = `<svg width="${width}" height="${height}">`;

		for (let i = 0; i < MAX_ATTEMPTS; i++) {
			for (let j = 0; j < wordLen; j++) {

				const x = j * (BOARD_TILE_WIDTH + BOARD_TILE_GAP);
				const y = i * (BOARD_TILE_HEIGHT + BOARD_TILE_GAP);

				if (i < this.numAttempts) {

					const guess = this.guesses[i][j];
					const color = colors.get(guess.status);
					const fontSize = 18;
					svgContent += `
            <g>
              <rect x="${x}" y="${y}" width="${BOARD_TILE_WIDTH}" height="${BOARD_TILE_HEIGHT}" fill="${color}" />
              <text
				  fill="white"
                  font-size="${fontSize}"
                  font-family="Arial"
                  font-weight="bold"
                  x="${x + BOARD_TILE_WIDTH * 0.5}"
                  y="${y + BOARD_TILE_HEIGHT * 0.5 + 5.5}"
                  dominant-baseline="central"
                  text-anchor="middle">
                ${guess.letter.toUpperCase()}
              </text>
            </g>
          `;
				}
				else {
					svgContent += `
          <g>
            <rect x="${x}" y="${y}" width="${BOARD_TILE_WIDTH}" height="${BOARD_TILE_HEIGHT}" fill="${colors.get(GuessStatus.Unknown)}" />
          </g>
          `
				}
			}
		}

		svgContent += `</svg>`;
		const buffer = await sharp(Buffer.from(svgContent)).toBuffer();

		// padd with transparency to the right
		return buffer;
	}
}

const wordle = new WordleManager('wordle', 'Play games of Wordle');

export default wordle;