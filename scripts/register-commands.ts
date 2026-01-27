import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const commands = [
    new SlashCommandBuilder()
        .setName('apostar')
        .setDescription('Cria uma nova aposta')
        .addStringOption(option =>
            option.setName('modo')
                .setDescription('Modo de jogo')
                .setRequired(true)
                .addChoices(
                    { name: 'X1 Normal', value: 'x1_normal' },
                    { name: 'X1 Infinito', value: 'x1_infinito' },
                    { name: '2x2', value: '2x2' },
                    { name: '3x3', value: '3x3' },
                    { name: '4x4', value: '4x4' }
                )
        )
        .addNumberOption(option =>
            option.setName('valor')
                .setDescription('Valor da aposta (Mínimo 25 MZN)')
                .setRequired(true)
                .setMinValue(25)
        ),
    new SlashCommandBuilder()
        .setName('ranking')
        .setDescription('Mostra o ranking dos melhores jogadores'),
    new SlashCommandBuilder()
        .setName('perfil')
        .setDescription('Mostra suas estatísticas ou de outro jogador')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuário para ver o perfil')
                .setRequired(false)
        ),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationCommands(process.env.DISCORD_APP_ID!),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();
