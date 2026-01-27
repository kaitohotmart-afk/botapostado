import { VercelRequest, VercelResponse } from '@vercel/node';
import { InteractionResponseType, MessageComponentTypes, ButtonStyleTypes } from 'discord-interactions';
import { supabase } from '../utils/supabase.js';
import { rest } from '../utils/discord.js';
import { Routes } from 'discord.js';

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

            return res.status(200).json({
                type: InteractionResponseType.UPDATE_MESSAGE,
                data: {
                    content: `Nova aposta criada por <@${bet.criador_admin_id}>!`,
                    embeds: [
                        {
                            title: '🔥 NOVA APOSTA DISPONÍVEL',
                            description: 'Qualquer jogador pode aceitar esta aposta.\n\n⚠️ **Os nomes dos jogadores serão revelados apenas após 2 jogadores aceitarem.**',
                            color: 0xFFAA00,
                            fields: [
                                { name: 'Modo', value: modoNome, inline: true },
                                { name: 'Valor', value: `${bet.valor} MZN`, inline: true },
                                { name: 'Tipo de Sala', value: modoSalaText, inline: true },
                                { name: 'Status', value: '⏳ Aguardando Jogadores (1/2)', inline: false },
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
        }

        // 7. BOTH ACCEPTED - Create private channel
        const player1Id = bet.jogador1_id || discordId;
        const player2Id = playerSlot === '2' ? discordId : bet.jogador2_id;

        const channelName = `aposta-${betId.substring(0, 8)}`;

        // Permission bitflags as strings
        const DENY_VIEW = '1024';
        const ALLOW_VIEW_ONLY = '1024';
        const DENY_SEND = '2048';
        const ALLOW_VIEW_SEND = '3072';

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
                    deny: DENY_SEND,
                    allow: ALLOW_VIEW_ONLY,
                },
                {
                    id: player2Id,
                    type: 1,
                    deny: DENY_SEND,
                    allow: ALLOW_VIEW_ONLY,
                },
                {
                    id: bet.criador_admin_id,
                    type: 1,
                    deny: '0',
                    allow: ALLOW_VIEW_SEND,
                },
            ],
        };

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

        // 9. Send info to channel
        const modoSalaText = bet.modo_sala === 'full_mobile' ? '📱 FULL MOBILE' : '📱💻 MISTO (Mobile + Emulador)';
        const modoNome = bet.modo.replace('_', ' ').toUpperCase();

        await rest.post(Routes.channelMessages(channel.id), {
            body: {
                content: `<@${player1Id}> <@${player2Id}>`,
                embeds: [
                    {
                        title: '⚔️ PARTIDA ACEITA',
                        description: `**Jogador 1:** <@${player1Id}>\n**Jogador 2:** <@${player2Id}>\n\n🔒 **O chat está bloqueado até que o admin confirme o pagamento.**`,
                        color: 0x00FF00,
                        fields: [
                            { name: 'Modo', value: modoNome, inline: true },
                            { name: 'Valor', value: `${bet.valor} MZN`, inline: true },
                            { name: 'Tipo de Sala', value: modoSalaText, inline: false },
                        ]
                    },
                    {
                        title: '💳 INFORMAÇÕES DE PAGAMENTO',
                        description: 'Para realizar os pagamentos das apostas, utilize um dos seguintes números:\n\n**e-Mola:** `877771719`\n**M-Pesa:** `842482984`\n**Titular:** Kaito Luis\n\nSomente após a confirmação do pagamento a aposta será validada e o chat será liberado.',
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
