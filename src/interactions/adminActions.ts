import { VercelRequest, VercelResponse } from '@vercel/node';
import { InteractionResponseType, MessageComponentTypes, ButtonStyleTypes } from 'discord-interactions';
import { supabase } from '../utils/supabase.js';
import { rest } from '../utils/discord.js';
import { Routes } from 'discord.js';
import { updatePlayerLevel, incrementPlayerStats } from '../utils/levels.js';

// Helper to check for Admin/Staff permissions
async function checkAdminPermission(interaction: any): Promise<boolean> {
    const { member, guild_id } = interaction;
    const memberRoles = member.roles || [];
    const memberPermissions = member.permissions || '0';
    const ADMINISTRATOR_PERMISSION = BigInt(8);
    const userPermissions = BigInt(memberPermissions);
    const hasAdminPermission = (userPermissions & ADMINISTRATOR_PERMISSION) !== BigInt(0);

    if (hasAdminPermission) return true;

    try {
        // Fetch guild roles to check for specific role names
        const roles = await rest.get(Routes.guildRoles(guild_id)) as any[];
        const staffRoles = roles.filter((r: any) => r.name === 'Dono' || r.name === 'botAP');
        const staffRoleIds = staffRoles.map((r: any) => r.id);

        return memberRoles.some((id: string) => staffRoleIds.includes(id));
    } catch (error) {
        console.error('Error checking admin permissions:', error);
        return false;
    }
}

export async function handleAdminAction(req: VercelRequest, res: VercelResponse, interaction: any, action: string, betId: string) {
    // 1. Strict Permission Check
    const isAdmin = await checkAdminPermission(interaction);
    if (!isAdmin) {
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: '❌ Apenas administradores podem usar este botão.', flags: 64 }
        });
    }

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
                data: {
                    content: `✅ **Pagamento confirmado!** Chat liberado.\n\n👤 **Jogador 1:** <@${bet.jogador1_id}>\n👤 **Jogador 2:** <@${bet.jogador2_id}>\n\nBoa sorte aos jogadores!`,
                    allowed_mentions: { parse: ['users'] }
                }
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
    // 1. Strict Permission Check
    const isAdmin = await checkAdminPermission(interaction);
    if (!isAdmin) {
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: '❌ Apenas administradores podem usar este botão.', flags: 64 }
        });
    }

    try {
        if (!betId) throw new Error('Bet ID is missing');

        const { data: bet, error: betError } = await supabase
            .from('bets')
            .select('*')
            .eq('id', betId)
            .single();

        if (betError) throw betError;
        if (!bet) throw new Error('Bet not found');

        // Fetch usernames for buttons
        let p1Name = 'Jogador 1';
        let p2Name = 'Jogador 2';
        try {
            const p1 = await rest.get(Routes.user(bet.jogador1_id)) as any;
            const p2 = await rest.get(Routes.user(bet.jogador2_id)) as any;
            p1Name = p1.username;
            p2Name = p2.username;
        } catch (e) {
            console.warn('Could not fetch usernames for buttons', e);
        }

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
                                label: `Vencedor: ${p1Name}`,
                                custom_id: `select_winner:${betId}:${bet.jogador1_id}:${type}`,
                            },
                            {
                                type: MessageComponentTypes.BUTTON,
                                style: ButtonStyleTypes.PRIMARY,
                                label: `Vencedor: ${p2Name}`,
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
            data: { content: '❌ Erro ao selecionar tipo de finalização. Verifique os logs.', flags: 64 }
        });
    }
}

export async function handleSelectWinner(req: VercelRequest, res: VercelResponse, interaction: any, betId: string, winnerId: string, type: string) {
    // 1. Strict Permission Check
    const isAdmin = await checkAdminPermission(interaction);
    if (!isAdmin) {
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: '❌ Apenas administradores podem usar este botão.', flags: 64 }
        });
    }

    try {
        // 1. Get bet details
        const { data: bet, error: betError } = await supabase
            .from('bets')
            .select('*')
            .eq('id', betId)
            .single();

        if (betError) throw betError;
        if (!bet) throw new Error('Bet not found');

        if (bet.status === 'finalizada') {
            return res.status(200).json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ Esta aposta já foi finalizada.', flags: 64 }
            });
        }

        const loserId = winnerId === bet.jogador1_id ? bet.jogador2_id : bet.jogador1_id;
        const totalBet = Number(bet.valor) * 2;
        let payout = 0;
        let fee = 0;
        let finalizationType = type === 'normal' ? 'normal' : 'wo_irregularidade';

        // 2. Calculate Fees and Payouts
        if (type === 'normal') {
            // Fee Rules:
            // <= 200 MT total: 10%
            // >= 300 MT total: 5%

            const feePercentage = totalBet >= 300 ? 0.05 : 0.10;
            fee = totalBet * feePercentage;
            payout = totalBet - fee;
        } else {
            // WO / Irregularity Rules:
            // Winner gets: Own Bet + 70% of Loser's Bet
            // Admin keeps: 30% of Loser's Bet
            // Loser gets: 0 refund

            const winnerOwnBet = Number(bet.valor);
            const loserBet = Number(bet.valor);
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

        // 4. Update Winner Stats & Level
        // Winner: +1 win, +profit
        const winnerProfit = payout - Number(bet.valor);
        await incrementPlayerStats(winnerId, true, Number(bet.valor), winnerProfit);
        await updatePlayerLevel(winnerId, interaction.guild_id);

        // 5. Update Loser Stats & Level
        // Loser: +1 loss, -bet amount
        await incrementPlayerStats(loserId, false, Number(bet.valor), -Number(bet.valor));
        await updatePlayerLevel(loserId, interaction.guild_id);

        // 6. Get Winner Name (Display Name or Username)
        let winnerName = `<@${winnerId}>`; // Fallback
        try {
            // Try to fetch guild member for nickname (displayName)
            const member = await rest.get(Routes.guildMember(interaction.guild_id, winnerId)) as any;
            winnerName = `**${member.nick || member.user.username}**`;
        } catch (e) {
            try {
                // Fallback to user fetch if member fetch fails
                const user = await rest.get(Routes.user(winnerId)) as any;
                winnerName = `**${user.username}**`;
            } catch (e2) {
                console.warn('Could not fetch winner name', e2);
            }
        }

        // 7. Send Log and Close Button
        const embedDescription = type === 'normal'
            ? `💰 **Valor Total:** ${totalBet} MT\n📉 **Taxa:** ${fee} MT\n💵 **Prêmio:** ${payout} MT`
            : `🚨 **Vitória por Irregularidade**\n💰 **Valor Total:** ${totalBet} MT\n📉 **Taxa (30% do perdedor):** ${fee} MT\n💵 **Prêmio (Aposta + 70% do perdedor):** ${payout} MT`;

        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: `🏆 Vencedor: ${winnerName}\nPerdedor: <@${loserId}>`,
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
            data: { content: '❌ Erro ao finalizar aposta. Verifique os logs.', flags: 64 }
        });
    }
}

export async function handleCloseChannel(req: VercelRequest, res: VercelResponse, interaction: any, channelId: string) {
    // Also restrict closing channel? Usually yes.
    const isAdmin = await checkAdminPermission(interaction);
    if (!isAdmin) {
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: '❌ Apenas administradores podem fechar o canal.', flags: 64 }
        });
    }

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
