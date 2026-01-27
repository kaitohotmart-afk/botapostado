import { VercelRequest, VercelResponse } from '@vercel/node';
import { InteractionResponseType } from 'discord-interactions';
import { supabase } from '../utils/supabase.js';

export async function handleRankingCommand(req: VercelRequest, res: VercelResponse, interaction: any) {
    try {
        const { data: players, error } = await supabase
            .from('players')
            .select('*')
            .order('vitorias', { ascending: false })
            .limit(10);

        if (error) throw error;

        const rankingList = players.map((p, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
            return `${medal} **${p.nome}** - ${p.vitorias} Vitórias`;
        }).join('\n');

        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                embeds: [
                    {
                        title: '🏆 TOP 10 JOGADORES',
                        description: rankingList || 'Nenhum jogador registrado ainda.',
                        color: 0xFFD700 // Gold
                    }
                ]
            }
        });

    } catch (error) {
        console.error('Error fetching ranking:', error);
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: '❌ Erro ao buscar ranking.', flags: 64 }
        });
    }
}
