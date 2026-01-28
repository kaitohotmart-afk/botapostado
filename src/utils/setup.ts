import { rest } from './discord.js';
import { Routes, ChannelType, PermissionFlagsBits } from 'discord.js';
import { supabase } from './supabase.js';

const CATEGORY_NAME = 'SISTEMA DE APOSTAS';
const CHANNELS = [
    { name: 'como-funciona', type: ChannelType.GuildText, topic: 'Instruções de como usar o bot de apostas.' },
    { name: 'ranking', type: ChannelType.GuildText, topic: 'Ranking de vitórias e derrotas.' },
    { name: 'apostas-abertas', type: ChannelType.GuildText, topic: 'Apostas disponíveis para jogar.' }
];

export async function setupGuildChannels(guildId: string) {
    try {
        const channels = await rest.get(Routes.guildChannels(guildId)) as any[];

        // 1. Find or Create Category
        let category = channels.find(c => c.name === CATEGORY_NAME && c.type === ChannelType.GuildCategory);

        if (!category) {
            category = await rest.post(Routes.guildChannels(guildId), {
                body: {
                    name: CATEGORY_NAME,
                    type: ChannelType.GuildCategory
                }
            });
        }

        const categoryId = category.id;

        // 2. Ensure Channels Exist
        for (const channelConfig of CHANNELS) {
            const existingChannel = channels.find(c => c.name === channelConfig.name && c.parent_id === categoryId);

            if (!existingChannel) {
                await rest.post(Routes.guildChannels(guildId), {
                    body: {
                        name: channelConfig.name,
                        type: channelConfig.type,
                        topic: channelConfig.topic,
                        parent_id: categoryId
                    }
                });
            }
        }

    } catch (error) {
        console.error('Error setting up guild channels:', error);
    }
}

export async function updateRanking(channelId: string) {
    try {
        // Fetch top 10 players by wins
        const { data: players, error } = await supabase
            .from('player_levels') // Assuming player_levels has the stats, or adjust to match leaderboard.ts logic if needed. 
            // leaderboard.ts uses 'player_levels' for general ranking.
            .select('discord_id, total_wins, total_losses') // Adjusted to match likely schema or what was there
            .order('total_wins', { ascending: false })
            .limit(10);

        if (error) throw error;

        if (!players || players.length === 0) return;

        const embed = {
            title: '🏆 RANKING DE JOGADORES',
            description: 'Os 10 melhores jogadores baseados em vitórias.',
            color: 0xF1C40F,
            fields: players.map((p: any, i: number) => ({
                name: `${i + 1}. <@${p.discord_id}>`,
                value: `Vitórias: **${p.total_wins || 0}** | Derrotas: **${p.total_losses || 0}**`,
                inline: false
            })),
            timestamp: new Date().toISOString(),
            footer: { text: 'KAITO FF - Desempenho em Partidas' }
        };

        // Delete old messages first to keep it clean
        const messages = await rest.get(Routes.channelMessages(channelId)) as any[];
        for (const msg of messages) {
            await rest.delete(Routes.channelMessage(channelId, msg.id));
        }

        await rest.post(Routes.channelMessages(channelId), {
            body: { embeds: [embed] }
        });

    } catch (error) {
        console.error('Error updating ranking:', error);
    }
}
