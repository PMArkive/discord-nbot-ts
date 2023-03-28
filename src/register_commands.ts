import { SlashCommandBuilder } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';

const weather = new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Retrieves the weather for a given location')
    .addStringOption(option =>
        option.setName('location')
            .setDescription('Country, state, city, or address')
            .setRequired(false))

const animal = new SlashCommandBuilder()
.setName('animal')
.setDescription('Posts a random animal')
.addStringOption(option =>
    option
    .setDescription('The animal to post')
    .setRequired(true)
    .setName('species')
    .setChoices(
		{name: 'cat', value: 'cat'},
		{name: 'dog', value: 'dog'},
		{name: 'lizard', value: 'lizard'},
    ))

const namecolor = new SlashCommandBuilder()
    .setName('namecolor')
    .setDescription('Gives you a custom name color')
    .addStringOption(option =>
        option.setName('hex')
            .setDescription('Hex code for the color')
            .setRequired(true))

const reminder = new SlashCommandBuilder()
.setName('reminder')
.setDescription('Reminds you of something in the future')
.addStringOption(option =>
    option.setName('message')
        .setDescription('Message to remind you of')
        .setRequired(true))
.addNumberOption(option =>
    option.setName('days')
        .setDescription('Days in the future')
        .setRequired(false))
.addNumberOption(option =>
    option.setName('hours')
        .setDescription('Hours in the future')
        .setRequired(false))
.addNumberOption(option =>
    option.setName('minutes')
        .setDescription('Minutes in the future')
        .setRequired(false))


const mimic = new SlashCommandBuilder()
	.setName('mimic')
	.setDescription('Mimics a user based on their previous messages')
	.addUserOption(option =>
		option.setName('user')
			.setDescription('User to mimic')
			.setRequired(false))

const mimic_optout = new SlashCommandBuilder()
	.setName('mimic_optout')
	.setDescription('Opts out of mimic')

const inspire = new SlashCommandBuilder()
    .setName('inspire')
    .setDescription('Retrieves a random inspirational quote')

const starboard = new SlashCommandBuilder()
    .setName('starboard')
    .setDescription('Sets the starboard channel')
    .addChannelOption(option =>
        option.setName('channel')
            .setDescription('The channel to set as the starboard channel')
            .setRequired(true))


const wordle = new SlashCommandBuilder()
    .setName('wordle')
    .setDescription('Starts a game of wordle')
    .addIntegerOption(option =>
        option.setName('length')
            .setDescription('The length of the words to use')
            .setRequired(false))
    .addStringOption(option =>
        option.setName('starter_words')
            .setDescription('Space separated list of guesses to preload into the game')
            .setRequired(false))

const emoter = new SlashCommandBuilder()
.setName('emoter')
.setDescription('Interact with the emoter module')
.addSubcommand(subcommand =>
    subcommand
        .setName('test')
        .setDescription('Test whether a specific keyword resolves to a valid emote')
        .addStringOption(option => option.setName('keyword').setDescription('Keyword to match against').setRequired(true)))
.addSubcommand(subcommand =>
    subcommand
        .setName('add')
        .setDescription('Add a keyword to the emoter module')
        .addStringOption(option => option.setName('keyword').setDescription('Emote keyword')
            .setRequired(true))
        .addStringOption(option => option.setName('url').setDescription('Emote image URL. Supports JPG, PNG and GIF')
            .setRequired(true)))
.addSubcommand(subcommand =>
    subcommand
        .setName('edit')
        .setDescription('Edit a keyword in the emoter module')
        .addStringOption(option => option.setName('keyword').setDescription('Emote keyword')
            .setRequired(true))
        .addStringOption(option => option.setName('url').setDescription('New emote image URL. Supports JPG, PNG and GIF')
            .setRequired(true)))
.addSubcommand(subcommand =>
    subcommand
        .setName('remove')
        .setDescription('Removes a keyword from the emoter module')
        .addStringOption(option => option.setName('keyword').setDescription('Emote keyword')
            .setRequired(true)))
.addSubcommand(subcommand =>
    subcommand
        .setName('find')
        .setDescription('Find possible emotes for a partial keyword')
        .addStringOption(option => option.setName('keyword').setDescription('Emote keyword')
            .setRequired(true)))
.addSubcommand(subcommand =>
    subcommand
        .setName('random')
        .setDescription('Posts a random emote to chat'))
.addSubcommand(subcommand =>
    subcommand
        .setName('disable')
        .setDescription('Disables an emote keyword')
        .addStringOption(option => option.setName('keyword').setDescription('Emote keyword').setRequired(true)))


const moduler = new SlashCommandBuilder()
.setName('module')
.setDescription('Modules settings')
.addSubcommand(subcommand =>
    subcommand
        .setName('list')
        .setDescription('Lists all available modules and their status'))
.addSubcommand(subcommand =>
    subcommand
        .setName('disable')
        .setDescription('Disables a module')
        .addStringOption(option => option.setName('name').setDescription('Module name')
            .setRequired(true)))
.addSubcommand(subcommand =>
    subcommand
        .setName('enable')
        .setDescription('Enables a module')
        .addStringOption(option => option.setName('name').setDescription('Module name')
            .setRequired(true)))

const imagine = new SlashCommandBuilder()
	.setName('imagine')
	.setDescription('Generate an image from any prompt you give')
	.addStringOption(option =>
		option.setName('prompt')
			.setDescription('Prompt to generate an image from')
			.setRequired(true))

const vocalize = new SlashCommandBuilder()
.setName('vocalize')
.setDescription('Generate speech from any prompt you give')
.addStringOption(option =>
	option
		.setName('voice')
		.setDescription('Audio model to use')
		.setAutocomplete(true)
		.setRequired(true))
.addStringOption(option =>
	option.setName('prompt')
		.setDescription('Prompt to generate speech from')
		.setRequired(true))


const stats = new SlashCommandBuilder()
.setName('stats')
.setDescription('Show usage stats for the bot')


const complete = new SlashCommandBuilder()
.setName('complete')
.setDescription('Generate text from a given prompt')
.addStringOption(option =>
	option
		.setName('prompt')
		.setDescription('Starter text to use. You can use double spaces to indicate line breaks')
		.setRequired(true))

const compose = new SlashCommandBuilder()
.setName('compose')
.setDescription('Compose a song')
.addStringOption(option =>
	option
		.setName('style')
		.setDescription('Style of music')
		.setRequired(true)
		.setChoices(
			{ name: 'chamber', value: 'chamber' },
			{ name: 'piano', value: 'piano' },
			{ name: 'rock_and_metal', value: 'rock_and_metal' },
			{ name: 'synth', value: 'synth' },
			{ name: 'church', value: 'church' },
			{ name: 'timpani_strings_harp', value: 'timpani_strings_harp' },
			{ name: 'country', value: 'country' },
			{ name: 'reggae', value: 'reggae' },
		))
.addStringOption(option =>
	option
		.setName('density')
		.setDescription('Density of notes')
		.setRequired(true)
		.setChoices(
			{name: 'low', value: 'low'},
			{name: 'medium', value: 'medium'},
			{name: 'high', value: 'high'},
		))
.addStringOption(option =>
	option
		.setName('randomness')
		.setDescription('Randomness scale')
		.setRequired(true)
		.setChoices(
			{ name: 'low', value: 'low' },
			{ name: 'medium', value: 'medium' },
			{ name: 'high', value: 'high' },
			{ name: 'very_high', value: 'very_high' }
		  ))

const commands = [
    weather.toJSON(),
    namecolor.toJSON(),
    inspire.toJSON(),
    animal.toJSON(),
    emoter.toJSON(),
    wordle.toJSON(),
    moduler.toJSON(),
    starboard.toJSON(),
    reminder.toJSON(),
	mimic.toJSON(),
	mimic_optout.toJSON(),
	//stats_wordle.toJSON(),
	stats.toJSON(),
	imagine.toJSON(),
	vocalize.toJSON(),
	complete.toJSON(),
	compose.toJSON()
];

const registerCommands = async (clientId: string, token: string) => {
    const rest = new REST({ version: '9' }).setToken(token);
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
}

export default registerCommands;