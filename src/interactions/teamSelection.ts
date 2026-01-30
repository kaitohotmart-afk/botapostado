import { InteractionResponseType, MessageComponentTypes, ButtonStyleTypes } from 'discord-interactions';
import { supabase } from '../utils/supabase.js';
import { rest } from '../utils/discord.js';
import { Routes } from 'discord.js';

export async function handleTeamSelection(req: any, res: any, interaction: any) {
    const { member, data, custom_id, channel_id, message } = interaction;
    const [_, team, betId] = custom_id.split(':');
    const userId = member?.user?.id || interaction?.user?.id;

    try {
        // 1. Fetch Bet Data
        const { data: bet, error } = await supabase
            .from('bets')
            .select('*')
            .eq('id', betId)
            .single();

        if (error || !bet) {
            return res.status(200).json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ Erro: Partida não encontrada.', flags: 64 }
            });
        }

        const playersData = bet.players_data || { pool: [], teamA: [], teamB: [] };
        const pool = playersData.pool || [];
        let teamA = playersData.teamA || [];
        let teamB = playersData.teamB || [];

        // 2. Validate Player
        if (!pool.includes(userId)) {
            return res.status(200).json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ Você não faz parte desta partida!', flags: 64 }
            });
        }

        // 3. Update Team Selection
        // Remove from both teams first to allow switching
        teamA = teamA.filter((id: string) => id !== userId);
        teamB = teamB.filter((id: string) => id !== userId);

        const teamSizeLimit = Math.ceil(pool.length / 2);

        if (team === 'A') {
            if (teamA.length >= teamSizeLimit) {
                return res.status(200).json({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: { content: '⚠️ O Time A já está cheio!', flags: 64 }
                });
            }
            teamA.push(userId);
        } else {
            if (teamB.length >= teamSizeLimit) {
                return res.status(200).json({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: { content: '⚠️ O Time B já está cheio!', flags: 64 }
                });
            }
            teamB.push(userId);
        }

        const updatedPlayersData = { ...playersData, teamA, teamB };

        // 4. Check if all players have selected teams
        const totalSelected = teamA.length + teamB.length;
        const allSelected = totalSelected === pool.length;

        // 5. Update DB
        const updatePayload: any = { players_data: updatedPlayersData };
        if (allSelected) {
            updatePayload.status = 'em_jogo';
            updatePayload.jogador2_id = teamB[0]; // Set second captain
        }

        const { error: updateError } = await supabase
            .from('bets')
            .update(updatePayload)
            .eq('id', bet.id);

        if (updateError) throw updateError;

        // 6. Update Embed
        const embed = message.embeds[0];
        embed.fields = [
            { name: '🔵 Time A', value: teamA.length > 0 ? teamA.map((id: string) => `<@${id}>`).join('\n') : 'Nenhum jogador', inline: true },
            { name: '🔴 Time B', value: teamB.length > 0 ? teamB.map((id: string) => `<@${id}>`).join('\n') : 'Nenhum jogador', inline: true },
        ];

        if (allSelected) {
            // Transition to Match Control Panel
            return res.status(200).json({
                type: 7, // UPDATE_MESSAGE
                data: {
                    content: message.content,
                    embeds: [{
                        title: "Painel da Aposta",
                        description: "Todos os jogadores selecionaram seus times! Use os botões abaixo para gerenciar a partida.\nApenas **Mediadores** ou **Admins** podem usar estes botões.",
                        color: 0x3498db,
                        fields: embed.fields
                    }],
                    components: [
                        {
                            type: MessageComponentTypes.ACTION_ROW,
                            components: [
                                {
                                    type: MessageComponentTypes.BUTTON,
                                    style: ButtonStyleTypes.SUCCESS,
                                    label: 'Finalizar Aposta',
                                    custom_id: `match_finalize:${bet.id}`,
                                    emoji: { name: '✅' }
                                },
                                {
                                    type: MessageComponentTypes.BUTTON,
                                    style: ButtonStyleTypes.DANGER,
                                    label: 'Cancelar Aposta',
                                    custom_id: `match_cancel:${bet.id}`,
                                    emoji: { name: '❌' }
                                }
                            ]
                        }
                    ]
                }
            });
        }

        return res.status(200).json({
            type: 7, // UPDATE_MESSAGE
            data: { embeds: [embed] }
        });

    } catch (err) {
        console.error("Team Selection Error:", err);
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: '❌ Ocorreu um erro ao selecionar seu time.', flags: 64 }
        });
    }
}
