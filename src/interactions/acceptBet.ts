import { VercelRequest, VercelResponse } from '@vercel/node';
import { InteractionResponseType, MessageComponentTypes, ButtonStyleTypes } from 'discord-interactions';
import { supabase } from '../utils/supabase.js';
import { rest } from '../utils/discord.js';
import { Routes } from 'discord.js';

export async function handleAcceptBet(req: VercelRequest, res: VercelResponse, interaction: any, betId: string, playerNum: string) {
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

        // 2. Check which player this person should be
        const isPlayer1 = playerNum === 'p1';
        const expectedPlayerId = isPlayer1 ? bet.jogador1_id : bet.jogador2_id;

        if (expectedPlayerId !== discordId) {
            return res.status(200).json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ Este botão não é para você.', flags: 64 }
            });
        }

        // 3. Check if already accepted
        const alreadyAccepted = isPlayer1 ? bet.jogador1_aceitou : bet.jogador2_aceitou;
        if (alreadyAccepted) {
            return res.status(200).json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '✅ Você já aceitou esta aposta.', flags: 64 }
            });
        }

        // 4. Ensure player exists
        let { error: playerError } = await supabase
            .from('players')
            .select('*')
            .eq('discord_id', discordId)
            .single();

        if (playerError && playerError.code === 'PGRST116') {
            await supabase.from('players').insert([{ discord_id: discordId, nome: username }]);
        }

        // 5. Update acceptance
        const updateField = isPlayer1 ? 'jogador1_aceitou' : 'jogador2_aceitou';
        const { error: updateError } = await supabase
            .from('bets')
            .update({ [updateField]: true })
            .eq('id', betId);

        if (updateError) throw updateError;

        // 6. Check if both accepted
        const bothAccepted = isPlayer1 ? bet.jogador2_aceitou : bet.jogador1_aceitou;

        if (!bothAccepted) {
            // Only one accepted so far
            const modoSalaText = bet.modo_sala === 'full_mobile' ? '📱 FULL MOBILE' : '📱💻 MISTO';
            const modoNome = bet.modo.replace('_', ' ').toUpperCase();

            return res.status(200).json({
                type: InteractionResponseType.UPDATE_MESSAGE,
                data: {
                    content: `Nova aposta criada por <@${bet.criador_admin_id}>!`,
                    embeds: [
                        {
                            title: '🔥 NOVA APOSTA DISPONÍVEL',
                            description: 'Dois jogadores foram convocados para esta partida.\n\n⚠️ **Os nomes dos adversários serão revelados apenas após ambos aceitarem.**',
                            color: 0xFFAA00,
                            fields: [
                                { name: 'Modo', value: modoNome, inline: true },
                                { name: 'Valor', value: `${bet.valor} MZN`, inline: true },
                                { name: 'Tipo de Sala', value: modoSalaText, inline: true },
                                { name: 'Status', value: '⏳ Aguardando Aceitação (1/2)', inline: false },
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
                                    label: 'Jogador 1: Aceitar',
                                    custom_id: `accept_bet_p1:${bet.id}`,
                                    emoji: { name: '✅' },
                                    disabled: bet.jogador1_aceitou || isPlayer1
                                },
                                {
                                    type: MessageComponentTypes.BUTTON,
                                    style: ButtonStyleTypes.SUCCESS,
                                    label: 'Jogador 2: Aceitar',
                                    custom_id: `accept_bet_p2:${bet.id}`,
                                    emoji: { name: '✅' },
                                    disabled: bet.jogador2_aceitou || !isPlayer1
                                }
                            ]
                        }
                    ]
                }
            });
        }

        // 7. BOTH ACCEPTED - Create private channel
        const channelName = `aposta-${betId.substring(0, 8)}`;

        // Permission bitflags as strings
        const DENY_VIEW = '1024'; // VIEW_CHANNEL
        const ALLOW_VIEW_ONLY = '1024'; // VIEW_CHANNEL
        const DENY_SEND = '2048'; // SEND_MESSAGES
        const ALLOW_VIEW_SEND = '3072'; // VIEW_CHANNEL (1024) + SEND_MESSAGES (2048)

        // Get admin role IDs (we need to fetch from guild or use resolved data)
        // For now, we'll add permissions for the bot and individual admin
        const channelData = {
            name: channelName,
            type: 0, // GUILD_TEXT
            permission_overwrites: [
                {
                    id: guild_id, // @everyone
                    type: 0, // role
                    deny: DENY_VIEW,
                    allow: '0',
                },
                {
                    id: bet.jogador1_id,
                    type: 1, // member
                    deny: DENY_SEND, // Can view but NOT send
                    allow: ALLOW_VIEW_ONLY,
                },
                {
                    id: bet.jogador2_id,
                    type: 1, // member
                    deny: DENY_SEND, // Can view but NOT send
                    allow: ALLOW_VIEW_ONLY,
                },
                {
                    id: bet.criador_admin_id,
                    type: 1, // member (admin who created)
                    deny: '0',
                    allow: ALLOW_VIEW_SEND,
                },
            ],
        };

        // Create channel via REST
        const channel: any = await rest.post(Routes.guildChannels(guild_id), { body: channelData });

        // 8. Update Bet status
        const { error: finalUpdateError } = await supabase
            .from('bets')
            .update({
                status: 'aceita',
                canal_pagamento_id: channel.id
            })
            .eq('id', betId);

        if (finalUpdateError) throw finalUpdateError;

        // 9. Send Payment Info and Instructions to channel
        const modoSalaText = bet.modo_sala === 'full_mobile' ? '📱 FULL MOBILE' : '📱💻 MISTO (Mobile + Emulador)';
        const modoNome = bet.modo.replace('_', ' ').toUpperCase();

        await rest.post(Routes.channelMessages(channel.id), {
            body: {
                content: `<@${bet.jogador1_id}> <@${bet.jogador2_id}>`,
                embeds: [
                    {
                        title: '⚔️ PARTIDA ACEITA',
                        description: `**Jogador 1:** <@${bet.jogador1_id}>\n**Jogador 2:** <@${bet.jogador2_id}>\n\n🔒 **O chat está bloqueado até que o admin confirme o pagamento.**`,
                        color: 0x00FF00,
                        fields: [
                            { name: 'Modo', value: modoNome, inline: true },
                            { name: 'Valor', value: `${bet.valor} MZN`, inline: true },
                            { name: 'Tipo de Sala', value: modoSalaText, inline: false },
                        ]
                    },
                    {
                        title: '💳 INFORMAÇÕES DE PAGAMENTO',
                        description: 'Para realizar os pagamentos das apostas, utilize um dos seguintes números:\n\n**e-Mola:** 877771719\n**M-Pesa:** 842482984\n**Titular:** Kaito Luis\n\nSomente após a confirmação do pagamento a aposta será validada e o chat será liberado.',
                        color: 0x3498DB,
                    },
                    {
                        title: '📝 COMO FUNCIONA',
                        description: '1. Ambos jogadores enviam o valor\n2. Aguarde confirmação do admin\n3. **Admin confirma → Chat é liberado**\n4. Criem a sala no Free Fire\n5. Joguem a partida\n6. Enviem o print do resultado\n7. O vencedor recebe o prêmio',
                        color: 0x9B59B6
                    }
                ],
                components: [
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
                content: `✅ **Aposta aceita por ambos os jogadores!**\n\nCanal da partida: <#${channel.id}>`,
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
