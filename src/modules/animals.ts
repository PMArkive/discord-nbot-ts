import axios from "axios";
import { CommandInteraction } from "discord.js";

class RandomAnimal
{
    constructor() {
        console.log("RandomAnimal module loaded");
    }

    async handleCat(interaction: CommandInteraction) {
        const url = 'https://api.thecatapi.com/v1/images/search';
        const resp = await axios.get(url)

        if (resp.status !== 200) {
            await interaction.reply('Failed to get cat image, all the cats are dead');
            return;
        }

        const imgUrl = resp.data[0].url;
        interaction.reply(imgUrl);
    }

    async handleDog(interaction: CommandInteraction) {
        const resp = await axios.get('https://dog.ceo/api/breeds/image/random');
        if (resp.status !== 200) {
            await interaction.reply("Failed to get dog image, all the dogs are dead");
            return;
        }

        const dogUrl = resp.data.message;
        interaction.reply(dogUrl);
    }

    async handleLizard(interaction: CommandInteraction)
    {
        const resp = await axios.get('https://nekos.life/api/v2/img/lizard');
        if (resp.status !== 200) {
            await interaction.reply("Failed to get lizard image, all the lizards are dead");
            return;
        }

        const lizardUrl = resp.data.url;
        interaction.reply(lizardUrl);
    }

    
    async handleInteraction(interaction: CommandInteraction) {
   
        const option = interaction.options.getString("species");
        switch (option) {
            case "dog":
                await this.handleDog(interaction);
                break;
            case "cat":
                await this.handleCat(interaction);
                break;
            case "lizard":
                await this.handleLizard(interaction);
                break;
            default:
                await interaction.reply(`Unknown animal ${option}`);
                break;
        }
    }

}

const animals = new RandomAnimal();

export default animals;