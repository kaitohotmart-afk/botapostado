import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const commands = [
    new SlashCommandBuilder()
        .setName('apostar')
        .setDescription('Cria uma nova aposta')
        .setDefaultMemberPermissions(null)
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
        )
        .addStringOption(option =>
            option.setName('modo_sala')
                .setDescription('Tipo de sala permitido')
                .setRequired(true)
                .addChoices(
                    { name: 'FULL MOBILE', value: 'full_mobile' },
                    { name: 'MISTO (Mobile + Emulador)', value: 'misto' }
                )
        )
        .addStringOption(option =>
            option.setName('estilo_sala')
                .setDescription('Estilo da sala')
                .setRequired(true)
                .addChoices(
                    { name: 'Normal', value: 'normal' },
                    { name: 'Tático', value: 'tatico' }
                )
        ),
    new SlashCommandBuilder()
        .setName('ranking')
        .setDescription('Mostra o ranking dos melhores jogadores')
        .setDefaultMemberPermissions(null),
    new SlashCommandBuilder()
        .setName('perfil')
        .setDescription('Mostra suas estatísticas ou de outro jogador')
        .setDefaultMemberPermissions(null)
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuário para ver o perfil')
                .setRequired(false)
        ),
    new SlashCommandBuilder()
        .setName('setup_queue')
        .setDescription('Configura uma fila automática (Admin)')
        .setDefaultMemberPermissions('8') // Administrator
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Modo de jogo (1x1, 2x2, etc)')
                .setRequired(true)
                .addChoices(
                    { name: '1x1', value: '1x1' },
                    { name: '2x2', value: '2x2' },
                    { name: '3x3', value: '3x3' },
                    { name: '4x4', value: '4x4' }
                )
        )
        .addNumberOption(option =>
            option.setName('value')
                .setDescription('Valor da aposta')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('platform')
                .setDescription('Plataforma permitida')
                .setRequired(false)
                .addChoices(
                    { name: 'Mobile Only', value: 'mobile' },
                    { name: 'Misto', value: 'mixed' }
                )
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
