import { VercelRequest, VercelResponse } from '@vercel/node';
import { InteractionResponseType, MessageComponentTypes, ButtonStyleTypes } from 'discord-interactions';
import { supabase } from '../utils/supabase.js';
import { addCreatorRole } from '../utils/roles.js';

export async function handleCancelBet(req: VercelRequest, res: VercelResponse, interaction: any, betId: string) {
    const { member } = interaction;
    const discordId = member.user.id;

    try {
        // 1. Fetch bet
        const { data: bet, error: betError } = await supabase
            .from('bets')
            .select('*')
            .eq('id', betId)
            .single();

        if (betError || !bet) {
            return res.status(200).json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ Aposta não encontrada.', flags: 64 }
            });
        }

        // 2. Validate Status
        if (bet.status !== 'aguardando') {
            return res.status(200).json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ Esta aposta não pode ser cancelada agora.', flags: 64 }
            });
        }

        // 3. Check if user is the creator or a player
        const isCreator = bet.criador_admin_id === discordId;
        const isPlayer1 = bet.jogador1_id === discordId;
        const isPlayer2 = bet.jogador2_id === discordId;

        if (!isCreator && !isPlayer1 && !isPlayer2) {
            return res.status(200).json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ Você não tem permissão para cancelar esta aposta.', flags: 64 }
            });
        }

        // 4. Handle Creator Cancellation (Cancel the whole bet)
        if (isCreator) {
            const { error: cancelError } = await supabase
                .from('bets')
                .update({ status: 'cancelada' })
                .eq('id', betId);

            if (cancelError) throw cancelError;

            // Restore "Criador de Apostas" role if count < 2
            const { count } = await supabase
                .from('bets')
                .select('*', { count: 'exact', head: true })
                .eq('criador_admin_id', discordId)
                .in('status', ['aguardando', 'aceita', 'paga', 'em_jogo']);

            if (count !== null && count < 2) {
                await addCreatorRole(interaction.guild_id, discordId);
            }

            return res.status(200).json({
                type: InteractionResponseType.UPDATE_MESSAGE,
                data: {
                    content: `❌ **Aposta cancelada pelo criador.**`,
                    embeds: [],
                    components: []
                }
            });
        }

        // 5. Handle Player Cancellation (Just leave the bet)
        // If both slots are filled, cancellation is not allowed via this method (game is starting)
        if (bet.jogador1_id && bet.jogador2_id) {
            return res.status(200).json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ A aposta já foi aceita por ambos os jogadores. Não é possível sair.', flags: 64 }
            });
        }

        // 6. Remove player
        let updateData: any = {};
        if (isPlayer1) {
            updateData.jogador1_id = null;
            updateData.jogador1_aceitou = false;
        } else if (isPlayer2) {
            updateData.jogador2_id = null;
            updateData.jogador2_aceitou = false;
        }

        const { error: updateError } = await supabase
            .from('bets')
            .update(updateData)
            .eq('id', betId);

        if (updateError) throw updateError;

        // 7. Update Message to "0/2 Jogadores" state
        const modoSalaText = bet.modo_sala === 'full_mobile' ? '📱 FULL MOBILE' : '📱💻 MISTO';
        const modoNome = bet.modo.replace('_', ' ').toUpperCase();

        return res.status(200).json({
            type: InteractionResponseType.UPDATE_MESSAGE,
            data: {
                content: `Nova aposta criada por <@${bet.criador_admin_id}>!`,
                embeds: [
                    {
                        title: '🔥 NOVA APOSTA DISPONÍVEL',
                        description: 'Qualquer jogador pode aceitar esta aposta.\n\n⚠️ **Os nomes dos jogadores serão revelados apenas após 2 jogadores aceitarem.**',
                        color: 0xFF6B6B,
                        fields: [
                            { name: 'Modo', value: modoNome, inline: true },
                            { name: 'Valor', value: `${bet.valor} MZN`, inline: true },
                            { name: 'Tipo de Sala', value: modoSalaText, inline: true },
                            { name: 'Status', value: '⏳ Aguardando Jogadores (0/2)', inline: false },
                        ],
                        footer: { text: `Bet ID: ${bet.id}` },
                        timestamp: new Date().toISOString()
                    }
                ],
                components: [
                    {
                        type: MessageComponentTypes.ACTION_ROW,
                        components: [
                            {
                                type: MessageComponentTypes.BUTTON,
                                style: ButtonStyleTypes.SUCCESS,
                                label: 'Aceitar Aposta',
                                custom_id: `accept_bet:${bet.id}`,
                                emoji: { name: '✅' }
                            }
                        ]
                    }
                ]
            }
        });

    } catch (error) {
        console.error('Error cancelling bet:', error);
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: '❌ Erro ao cancelar aposta.',
                flags: 64
            }
        });
    }
}
