import { VercelRequest, VercelResponse } from '@vercel/node';
import { InteractionResponseType, MessageComponentTypes, ButtonStyleTypes } from 'discord-interactions';
import { supabase } from '../utils/supabase.js';
import { rest } from '../utils/discord.js';
import { Routes } from 'discord.js';

export async function handleAdminAction(req: VercelRequest, res: VercelResponse, interaction: any, action: string, betId: string) {
    const { member } = interaction;

    // TODO: Check if user is admin/staff.

    try {
        if (action === 'confirm_payment') {
            // Fetch bet to get channel and players
            const { data: bet, error: betError } = await supabase
                .from('bets')
                .select('*')
                .eq('id', betId)
                .single();

            if (betError) throw betError;

            // Update bet status
            const { error } = await supabase
                .from('bets')
                .update({ status: 'paga' })
                .eq('id', betId);

            if (error) throw error;

            // Unlock chat for both players
            const channelId = bet.canal_pagamento_id;
            if (channelId) {
                const ALLOW_VIEW_SEND = '3072'; // VIEW_CHANNEL + SEND_MESSAGES

                // Update permissions for both players
                for (const playerId of [bet.jogador1_id, bet.jogador2_id]) {
                    await rest.put(Routes.channelPermission(channelId, playerId), {
                        body: {
                            type: 1, // member
                            allow: ALLOW_VIEW_SEND,
                            deny: '0'
                        }
                    });
                }
            }

            return res.status(200).json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '✅ Pagamento confirmado! Chat liberado para os jogadores. Aposta marcada como PAGA.' }
            });
        }

        if (action === 'start_match') {
            const { error } = await supabase
                .from('bets')
                .update({ status: 'em_jogo' })
                .eq('id', betId);

            if (error) throw error;

            return res.status(200).json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '🎮 Partida iniciada! Boa sorte aos jogadores.' }
            });
        }

        if (action === 'finish_bet') {
            // Fetch bet to get players
            const { data: bet, error: betError } = await supabase
                .from('bets')
                .select('*')
                .eq('id', betId)
                .single();

            if (betError) throw betError;

            // Ask for finalization type
            return res.status(200).json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: '🏁 Como a aposta foi finalizada?',
                    components: [
                        {
                            type: MessageComponentTypes.ACTION_ROW,
                            components: [
                                {
                                    type: MessageComponentTypes.BUTTON,
                                    style: ButtonStyleTypes.SUCCESS,
                                    label: 'Normal',
                                    custom_id: `select_winner_type:${betId}:normal`,
                                },
                                {
                                    type: MessageComponentTypes.BUTTON,
                                    style: ButtonStyleTypes.DANGER,
                                    label: 'WO / Irregularidade',
                                    custom_id: `select_winner_type:${betId}:irregular`,
                                }
                            ]
                        }
                    ]
                }
            });
        }

        return res.status(400).json({ error: 'Unknown admin action' });

    } catch (error) {
        console.error(`Error in admin action ${action}:`, error);
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: '❌ Erro ao processar ação de admin.', flags: 64 }
        });
    }
}

export async function handleSelectWinnerType(req: VercelRequest, res: VercelResponse, interaction: any, betId: string, type: string) {
    try {
        const { data: bet, error: betError } = await supabase
            .from('bets')
            .select('*')
            .eq('id', betId)
            .single();

        if (betError) throw betError;

        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: `🏆 Quem venceu a partida? (${type === 'normal' ? 'Normal' : 'Por Irregularidade'})`,
                components: [
                    {
                        type: MessageComponentTypes.ACTION_ROW,
                        components: [
                            {
                                type: MessageComponentTypes.BUTTON,
                                style: ButtonStyleTypes.PRIMARY,
                                label: `Vencedor: <@${bet.jogador1_id}>`,
                                custom_id: `select_winner:${betId}:${bet.jogador1_id}:${type}`,
                            },
                            {
                                type: MessageComponentTypes.BUTTON,
                                style: ButtonStyleTypes.PRIMARY,
                                label: `Vencedor: <@${bet.jogador2_id}>`,
                                custom_id: `select_winner:${betId}:${bet.jogador2_id}:${type}`,
                            }
                        ]
                    }
                ]
            }
        });
    } catch (error) {
        console.error('Error selecting winner type:', error);
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: '❌ Erro ao selecionar tipo de finalização.', flags: 64 }
        });
    }
}

export async function handleSelectWinner(req: VercelRequest, res: VercelResponse, interaction: any, betId: string, winnerId: string, type: string) {
    try {
        // 1. Get bet details
        const { data: bet, error: betError } = await supabase
            .from('bets')
            .select('*')
            .eq('id', betId)
            .single();

        if (betError) throw betError;

        if (bet.status === 'finalizada') {
            return res.status(200).json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ Esta aposta já foi finalizada.', flags: 64 }
            });
        }

        const loserId = winnerId === bet.jogador1_id ? bet.jogador2_id : bet.jogador1_id;
        const totalBet = bet.valor * 2;
        let payout = 0;
        let fee = 0;
        let finalizationType = type === 'normal' ? 'normal' : 'wo_irregularidade';

        // 2. Calculate Fees and Payouts
        if (type === 'normal') {
            // Fee Rules:
            // <= 200 MT total: 10%
            // >= 300 MT total: 5%
            // (Gap between 200 and 300? Assuming 10% for < 300 based on "a partir de 300")

            const feePercentage = totalBet >= 300 ? 0.05 : 0.10;
            fee = totalBet * feePercentage;
            payout = totalBet - fee;
        } else {
            // WO / Irregularity Rules:
            // Winner gets: Own Bet + 70% of Loser's Bet
            // Admin keeps: 30% of Loser's Bet
            // Loser gets: 0 refund

            const winnerOwnBet = bet.valor;
            const loserBet = bet.valor;
            const winnerShareOfLoser = loserBet * 0.70;

            payout = winnerOwnBet + winnerShareOfLoser;
            fee = loserBet * 0.30; // Admin fee
        }

        // 3. Update Bet
        const { error: updateBetError } = await supabase
            .from('bets')
            .update({
                status: 'finalizada',
                vencedor_id: winnerId,
                finalizado_em: new Date().toISOString(),
                taxa: fee,
                valor_pago: payout,
                tipo_finalizacao: finalizationType
            })
            .eq('id', betId);

        if (updateBetError) throw updateBetError;

        // 4. Update Winner Stats
        // Winner: +1 win, +payout (total gained), +1 match
        // Note: increment_stats now takes (user_id, is_win, bet_amount, payout_amount)
        await supabase.rpc('increment_stats', {
            user_id_param: winnerId,
            is_win: true,
            bet_amount: bet.valor,
            payout_amount: payout
        });

        // 5. Update Loser Stats
        // Loser: +1 loss, +0 payout, +1 match
        await supabase.rpc('increment_stats', {
            user_id_param: loserId,
            is_win: false,
            bet_amount: bet.valor,
            payout_amount: 0
        });

        // 6. Send Log and Close Button
        const embedDescription = type === 'normal'
            ? `💰 **Valor Total:** ${totalBet} MT\n📉 **Taxa:** ${fee} MT\n💵 **Prêmio:** ${payout} MT`
            : `🚨 **Vitória por Irregularidade**\n💰 **Valor Total:** ${totalBet} MT\n📉 **Taxa (30% do perdedor):** ${fee} MT\n💵 **Prêmio (Aposta + 70% do perdedor):** ${payout} MT`;

        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: `🏆 **Aposta Finalizada!**\n\nVencedor: <@${winnerId}>\nPerdedor: <@${loserId}>`,
                embeds: [
                    {
                        title: '📊 Resumo da Partida',
                        description: embedDescription,
                        color: type === 'normal' ? 0x00FF00 : 0xFF0000
                    }
                ],
                components: [
                    {
                        type: MessageComponentTypes.ACTION_ROW,
                        components: [
                            {
                                type: MessageComponentTypes.BUTTON,
                                style: ButtonStyleTypes.DANGER,
                                label: 'Fechar Canal',
                                custom_id: `close_channel:${bet.canal_pagamento_id}`,
                                emoji: { name: '🔒' }
                            }
                        ]
                    }
                ]
            }
        });

    } catch (error) {
        console.error('Error selecting winner:', error);
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: '❌ Erro ao finalizar aposta.', flags: 64 }
        });
    }
}

export async function handleCloseChannel(req: VercelRequest, res: VercelResponse, interaction: any, channelId: string) {
    try {
        await rest.delete(Routes.channel(channelId));
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: '🔒 Fechando canal...' }
        });
    } catch (error) {
        console.error('Error closing channel:', error);
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: '❌ Erro ao fechar o canal.', flags: 64 }
        });
    }
}
