import { VercelRequest, VercelResponse } from '@vercel/node';
import { InteractionResponseType } from 'discord-interactions';
import { supabase } from '../utils/supabase.js';
import { getCurrentSeasonIDs } from '../utils/seasons.js';

export async function handleLeaderboardCommand(req: VercelRequest, res: VercelResponse, interaction: any) {
    const { options } = interaction.data;
    const type = options && options.length > 0 ? options[0].value : 'weekly'; // Default to weekly

    try {
        let title = '';
        let data: any[] = [];
        let error: any = null;

        if (type === 'general') {
            title = '🏆 Ranking Geral';
            const result = await supabase
                .from('player_levels')
                .select('discord_id, total_wins, total_profit, level')
                .order('total_wins', { ascending: false })
                .limit(10);
            data = result.data || [];
            error = result.error;
        } else {
            const { weeklySeasonId, monthlySeasonId } = getCurrentSeasonIDs();
            const seasonId = type === 'weekly' ? weeklySeasonId : monthlySeasonId;
            title = type === 'weekly' ? `📅 Ranking Semanal (${seasonId})` : `🗓️ Ranking Mensal (${seasonId})`;

            const result = await supabase
                .from('season_rankings')
                .select('discord_id, wins, profit, win_rate')
                .eq('season_type', type)
                .eq('season_id', seasonId)
                .order('wins', { ascending: false })
                .limit(10);
            data = result.data || [];
            error = result.error;
        }

        if (error) throw error;

        if (data.length === 0) {
            return res.status(200).json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: `❌ Nenhum dado encontrado para o ${title}.` }
            });
        }

        // Format leaderboard
        let description = '';
        const medals = ['🥇', '🥈', '🥉'];

        for (let i = 0; i < data.length; i++) {
            const player = data[i];
            const rank = i + 1;
            const medal = i < 3 ? medals[i] : `#${rank}`;

            const wins = player.wins || player.total_wins || 0;
            const profit = player.profit || player.total_profit || 0;
            const profitText = new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(profit);

            description += `${medal} <@${player.discord_id}> \n`;
            description += `   └ ⚔️ Vitórias: **${wins}** | 💰 Lucro: **${profitText}**\n\n`;
        }

        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                embeds: [
                    {
                        title: title,
                        description: description,
                        color: 0xFFD700,
                        footer: { text: 'Atualizado em tempo real' }
                    }
                ]
            }
        });

    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: '❌ Erro ao buscar ranking.', flags: 64 }
        });
    }
}
