import { VercelRequest, VercelResponse } from '@vercel/node';
import { InteractionResponseType, MessageComponentTypes, ButtonStyleTypes } from 'discord-interactions';
import { supabase } from '../utils/supabase.js';
import { rest } from '../utils/discord.js';
import { Routes } from 'discord.js';
import { isPlayerBlocked, checkAndApplyActiveChatBan } from '../utils/faults.js';

export async function handleAcceptBet(req: VercelRequest, res: VercelResponse, interaction: any, betId: string) {
    const { member, guild_id } = interaction;
    const discordId = member.user.id;
    const username = member.user.username;

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

        if (bet.status !== 'aguardando') {
            return res.status(200).json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ Esta aposta já foi aceita ou cancelada.', flags: 64 }
            });
        }

        // 2. Check if player already accepted
        if (bet.jogador1_id === discordId || bet.jogador2_id === discordId) {
            return res.status(200).json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '✅ Você já aceitou esta aposta.', flags: 64 }
            });
        }

        // 2.1 Anti-Spam Check: REMOVED as per user request
        // Users can now join unlimited bets.

        // 2.2 Block Check
        const blockStatus = await isPlayerBlocked(discordId);
        if (blockStatus.blocked) {
            const untilDate = new Date(blockStatus.until!).toLocaleString('pt-MZ');
            return res.status(200).json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: `❌ Você está bloqueado de participar de apostas até **${untilDate}** devido ao acúmulo de faltas.`,
                    flags: 64
                }
            });
        }

        // 2.3 Active Chat Limit Check (Penalty)
        const chatBanStatus = await checkAndApplyActiveChatBan(discordId);
        if (chatBanStatus.banned) {
            const untilDate = new Date(chatBanStatus.until!).toLocaleString('pt-MZ');
            return res.status(200).json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: `❌ Você foi banido por 1 dia até **${untilDate}** por ter mais de 7 chats ativos sem finalização. Por favor, finalize suas apostas pendentes.`,
                    flags: 64
                }
            });
        }

        // 3. Ensure player exists in database
        let { error: playerError } = await supabase
            .from('players')
            .select('*')
            .eq('discord_id', discordId)
            .single();

        if (playerError && playerError.code === 'PGRST116') {
            await supabase.from('players').insert([{ discord_id: discordId, nome: username }]);
        }

        // 4. Assign player to first available slot
        let updateData: any = {};
        let playerSlot = '';

        if (!bet.jogador1_id) {
            updateData.jogador1_id = discordId;
            updateData.jogador1_aceitou = true;
            playerSlot = '1';
        } else if (!bet.jogador2_id) {
            updateData.jogador2_id = discordId;
            updateData.jogador2_aceitou = true;
            playerSlot = '2';
        } else {
            return res.status(200).json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ Esta aposta já está completa.', flags: 64 }
            });
        }

        // 5. Update bet
        const { error: updateError } = await supabase
            .from('bets')
            .update(updateData)
            .eq('id', betId);

        if (updateError) throw updateError;

        // 6. Check if both slots are filled
        const bothAccepted = (bet.jogador1_id || playerSlot === '1') && (bet.jogador2_id || playerSlot === '2');

        if (!bothAccepted) {
            // Only one player accepted so far
            const modoSalaText = bet.modo_sala === 'full_mobile' ? '📱 FULL MOBILE' : '📱💻 MISTO';
            const modoNome = bet.modo.replace('_', ' ').toUpperCase();
            const statusText = '⏳ Aguardando Jogadores (1/2)';
            const embedDescription = `Aposta criada por <@${bet.criador_admin_id}>. Aguardando um adversário para aceitar.\n\n⚠️ **Os nomes dos jogadores serão revelados apenas após o adversário aceitar.**`;

            return res.status(200).json({
                type: InteractionResponseType.UPDATE_MESSAGE,
                data: {
                    content: `🚨 **Nova aposta disponível!** @everyone\nTipo: **${modoNome}**\nValor: **${bet.valor}MT**`,
                    embeds: [
                        {
                            title: '🔥 NOVA APOSTA DISPONÍVEL',
                            description: embedDescription,
                            color: 0xFFAA00,
                            fields: [
                                { name: 'Modo', value: modoNome, inline: true },
                                { name: 'Valor', value: `${bet.valor} MZN`, inline: true },
                                { name: 'Tipo de Sala', value: modoSalaText, inline: true },
                                { name: 'Status', value: statusText, inline: false },
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
                                },
                                {
                                    type: MessageComponentTypes.BUTTON,
                                    style: ButtonStyleTypes.DANGER,
                                    label: 'Cancelar',
                                    custom_id: `cancel_bet:${bet.id}`,
                                    emoji: { name: '✖️' }
                                }
                            ]
                        }
                    ]
                }
            });
        }

        // 7. BOTH ACCEPTED - Create private channel
        const player1Id = bet.jogador1_id || discordId;
        const player2Id = playerSlot === '2' ? discordId : bet.jogador2_id;

        const channelName = `aposta-${betId.substring(0, 8)}`;

        // Permission bitflags as strings
        const DENY_VIEW = '1024';
        const ALLOW_VIEW_SEND_ATTACH = (BigInt(1024) | BigInt(2048) | BigInt(32768)).toString(); // VIEW + SEND + ATTACH

        const channelData = {
            name: channelName,
            type: 0,
            permission_overwrites: [
                {
                    id: guild_id,
                    type: 0,
                    deny: DENY_VIEW,
                    allow: '0',
                },
                {
                    id: player1Id,
                    type: 1,
                    deny: '0',
                    allow: ALLOW_VIEW_SEND_ATTACH,
                },
                {
                    id: player2Id,
                    type: 1,
                    deny: '0',
                    allow: ALLOW_VIEW_SEND_ATTACH,
                }
            ],
        };

        // If creator is NOT one of the players, add them with full access (assuming they are admin/staff)
        // If they ARE a player, they already have limited access above.
        if (bet.criador_admin_id !== player1Id && bet.criador_admin_id !== player2Id) {
            channelData.permission_overwrites.push({
                id: bet.criador_admin_id,
                type: 1,
                deny: '0',
                allow: ALLOW_VIEW_SEND_ATTACH,
            });
        }

        const channel: any = await rest.post(Routes.guildChannels(guild_id), { body: channelData });

        // 8. Update Bet status
        const { error: finalUpdateError } = await supabase
            .from('bets')
            .update({
                status: 'aceita',
                canal_pagamento_id: channel.id,
                aceita_em: new Date().toISOString()
            })
            .eq('id', betId);

        if (finalUpdateError) throw finalUpdateError;

        // 9. Send info to channel
        const modoSalaText = bet.modo_sala === 'full_mobile' ? '📱 FULL MOBILE' : '📱💻 MISTO (Mobile + Emulador)';
        const modoNome = bet.modo.replace('_', ' ').toUpperCase();
        const estiloSalaText = bet.estilo_sala === 'tatico' ? '🎯 TÁTICO' : '🎮 NORMAL';

        await rest.post(Routes.channelMessages(channel.id), {
            body: {
                content: `🔔 **Aposta Iniciada!**\nJogadores: **Jogador 1** vs **Jogador 2**\nAdmin/Criador: **Oculto**`,
                embeds: [
                    {
                        title: '⚔️ PARTIDA CONFIRMADA',
                        description: `Aposta entre **Jogador 1** e **Jogador 2**.\n\n✅ **O chat está liberado! Conversem e combinem a partida.**\n\n⚠️ **Os nomes dos adversários serão revelados após a confirmação do pagamento.**`,
                        color: 0x00FF00,
                        fields: [
                            { name: 'Modo', value: modoNome, inline: true },
                            { name: 'Valor', value: `${bet.valor} MZN`, inline: true },
                            { name: 'Tipo de Sala', value: modoSalaText, inline: true },
                            { name: 'Estilo', value: estiloSalaText, inline: true },
                        ],
                        footer: { text: `Bet ID: ${bet.id}` },
                        timestamp: new Date().toISOString()
                    },
                    {
                        title: '💳 PAGAMENTO REQUERIDO',
                        description: 'Selecione um administrador abaixo para ver os dados de pagamento e envie o **comprovante (foto/arquivo)** neste canal.',
                        color: 0x3498DB,
                    }
                ],
                components: [
                    {
                        type: MessageComponentTypes.ACTION_ROW,
                        components: [
                            {
                                type: MessageComponentTypes.BUTTON,
                                style: ButtonStyleTypes.SECONDARY,
                                label: 'Pagamento - Aleek',
                                custom_id: `payment_method:aleek:${betId}`,
                            },
                            {
                                type: MessageComponentTypes.BUTTON,
                                style: ButtonStyleTypes.SECONDARY,
                                label: 'Pagamento - Carlos',
                                custom_id: `payment_method:carlos:${betId}`,
                            },
                            {
                                type: MessageComponentTypes.BUTTON,
                                style: ButtonStyleTypes.SECONDARY,
                                label: 'Pagamento - Lilas',
                                custom_id: `payment_method:lilas:${betId}`,
                            },
                            {
                                type: MessageComponentTypes.BUTTON,
                                style: ButtonStyleTypes.SECONDARY,
                                label: 'Pagamento - Ryzen',
                                custom_id: `payment_method:ryzen:${betId}`,
                            }
                        ]
                    },
                    {
                        type: MessageComponentTypes.ACTION_ROW,
                        components: [
                            {
                                type: MessageComponentTypes.BUTTON,
                                style: ButtonStyleTypes.PRIMARY,
                                label: 'Confirmar Pagamento (Admin)',
                                custom_id: `confirm_payment:${betId}`,
                                emoji: { name: '💰' }
                            },
                            {
                                type: MessageComponentTypes.BUTTON,
                                style: ButtonStyleTypes.SUCCESS,
                                label: 'Iniciar Partida (Admin)',
                                custom_id: `start_match:${betId}`,
                                emoji: { name: '🎮' }
                            },
                            {
                                type: MessageComponentTypes.BUTTON,
                                style: ButtonStyleTypes.DANGER,
                                label: 'Finalizar Aposta (Admin)',
                                custom_id: `finish_bet:${betId}`,
                                emoji: { name: '🏁' }
                            }
                        ]
                    }
                ]
            }
        });

        // 10. Update Original Message
        return res.status(200).json({
            type: InteractionResponseType.UPDATE_MESSAGE,
            data: {
                content: `✅ **Aposta aceita por 2 jogadores!**\n\nCanal da partida: <#${channel.id}>`,
                embeds: [],
                components: []
            }
        });

    } catch (error) {
        console.error('Error accepting bet:', error);
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: '❌ Ocorreu um erro ao aceitar a aposta.',
                flags: 64
            }
        });
    }
}
