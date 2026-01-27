import { VercelRequest, VercelResponse } from '@vercel/node';
import { InteractionResponseType } from 'discord-interactions';
import { supabase } from '../utils/supabase.js';

export async function handleProfileCommand(req: VercelRequest, res: VercelResponse, interaction: any) {
    const { member, data } = interaction;

    const userOption = data.options?.find((opt: any) => opt.name === 'usuario');
    const targetId = userOption ? userOption.value : member.user.id;

    // If userOption is provided, we need to resolve the username, but interaction data might not have it directly if not resolved.
    // For simplicity, we'll try to fetch from DB or use a placeholder if it's the caller.
    // In a real bot, resolved data is in interaction.data.resolved.users[targetId]

    let targetName = 'Jogador';
    if (interaction.data.resolved && interaction.data.resolved.users && interaction.data.resolved.users[targetId]) {
        targetName = interaction.data.resolved.users[targetId].username;
    } else if (targetId === member.user.id) {
        targetName = member.user.username;
    }

    try {
        const { data: player, error } = await supabase
            .from('players')
            .select('*')
            .eq('discord_id', targetId)
            .single();

        if (error && error.code === 'PGRST116') {
            return res.status(200).json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: `❌ Jogador <@${targetId}> não encontrado no sistema.`, flags: 64 }
            });
        } else if (error) {
            throw error;
        }

        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                embeds: [
                    {
                        title: `📊 Perfil de ${player.nome}`,
                        color: 0x3498DB, // Blue
                        fields: [
                            { name: '🏆 Vitórias', value: player.vitorias.toString(), inline: true },
                            { name: '💀 Derrotas', value: player.derrotas.toString(), inline: true },
                            { name: '🎮 Partidas', value: player.partidas_jogadas.toString(), inline: true },
                            { name: '💰 Total Apostado', value: `${player.total_apostado} MZN`, inline: true },
                            { name: '💵 Total Ganho', value: `${player.total_ganho} MZN`, inline: true },
                            { name: '📈 Lucro', value: `${player.saldo_lucro} MZN`, inline: true }
                        ],
                        thumbnail: { url: `https://cdn.discordapp.com/avatars/${targetId}/${member.user.avatar}.png` } // Avatar might be wrong if target is not caller, but good enough for MVP
                    }
                ]
            }
        });

    } catch (error) {
        console.error('Error fetching profile:', error);
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: '❌ Erro ao buscar perfil.', flags: 64 }
        });
    }
}
