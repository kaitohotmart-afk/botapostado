import { InteractionResponseType, MessageComponentTypes, ButtonStyleTypes } from 'discord-interactions';
import { supabase } from '../utils/supabase.js';
import { getLevelProgress, getPlayerBadges } from '../utils/notifications.js';

export async function handlePanelCommand(req: any, res: any, interaction: any) {
    const userId = interaction.member?.user?.id || interaction.user?.id;

    try {
        // Fetch player stats
        const { data: player, error } = await supabase
            .from('player_levels')
            .select('*')
            .eq('discord_id', userId)
            .single();

        const progress = getLevelProgress(player?.total_bets || 0);
        const badges = getPlayerBadges(player || {});

        const statsEmbed = {
            title: '🎮 Painel do Jogador',
            description: `Olá <@${userId}>, este é o seu painel de controle.\n\n**Progresso para o nível ${progress.nextLevel.toUpperCase()}:**\n${progress.bar}\n*Faltam ${progress.total - progress.current} partidas*`,
            color: 0x3498db,
            fields: [
                { name: '🏆 Vitórias', value: player?.total_wins?.toString() || '0', inline: true },
                { name: '💀 Derrotas', value: player?.total_losses?.toString() || '0', inline: true },
                { name: '⭐ Nível', value: player?.level?.toUpperCase() || 'BRONZE', inline: true },
                { name: '💰 Lucro Total', value: `${player?.total_profit || 0} MT`, inline: true },
                { name: '🏅 Conquistas', value: badges, inline: false }
            ],
            footer: { text: 'Sistema de Apostas Antigravity' }
        };

        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                embeds: [statsEmbed],
                components: [
                    {
                        type: MessageComponentTypes.ACTION_ROW,
                        components: [
                            {
                                type: MessageComponentTypes.BUTTON,
                                style: ButtonStyleTypes.PRIMARY,
                                label: 'Meu Perfil',
                                custom_id: 'btn_profile',
                                emoji: { name: '👤' }
                            },
                            {
                                type: MessageComponentTypes.BUTTON,
                                style: ButtonStyleTypes.SUCCESS,
                                label: 'Ranking Filas',
                                custom_id: 'btn_ranking_queues',
                                emoji: { name: '⚔️' }
                            },
                            {
                                type: MessageComponentTypes.BUTTON,
                                style: ButtonStyleTypes.SECONDARY,
                                label: 'Ranking Geral',
                                custom_id: 'btn_ranking_general',
                                emoji: { name: '🏆' }
                            }
                        ]
                    }
                ]
            }
        });

    } catch (error) {
        console.error('Error in handlePanelCommand:', error);
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: '❌ Erro ao abrir o painel.', flags: 64 }
        });
    }
}
