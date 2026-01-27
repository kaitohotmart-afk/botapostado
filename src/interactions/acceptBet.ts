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

        if (bet.criador_id === discordId) {
            return res.status(200).json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ Você não pode aceitar sua própria aposta.', flags: 64 }
            });
        }

        // 2. Ensure opponent exists in players table
        let { error: playerError } = await supabase
            .from('players')
            .select('*')
            .eq('discord_id', discordId)
            .single();

        if (playerError && playerError.code === 'PGRST116') {
            await supabase.from('players').insert([{ discord_id: discordId, nome: username }]);
        }

        // 3. Create Private Channel
        const channelName = `aposta-${betId.substring(0, 8)}`;

        // Permission flags as strings (Discord REST API format)
        const DENY_VIEW = '1024'; // VIEW_CHANNEL
        const ALLOW_VIEW_SEND = '3072'; // VIEW_CHANNEL (1024) + SEND_MESSAGES (2048)

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
                    id: bet.criador_id,
                    type: 1, // member
                    deny: '0',
                    allow: ALLOW_VIEW_SEND,
                },
                {
                    id: discordId,
                    type: 1, // member
                    deny: '0',
                    allow: ALLOW_VIEW_SEND,
                },
            ],
        };

        // Create channel via REST
        const channel: any = await rest.post(Routes.guildChannels(guild_id), { body: channelData });

        // 4. Update Bet
        const { error: updateError } = await supabase
            .from('bets')
            .update({
                status: 'aceita',
                oponente_id: discordId,
                canal_pagamento_id: channel.id
            })
            .eq('id', betId);

        if (updateError) throw updateError;

        // 5. Send Payment Info to new channel
        await rest.post(Routes.channelMessages(channel.id), {
            body: {
                content: `<@${bet.criador_id}> <@${discordId}>`,
                embeds: [
                    {
                        title: '💳 INFORMAÇÕES DE PAGAMENTO',
                        description: 'Para realizar os pagamentos das apostas, utilize um dos seguintes números:\n\n**e-Mola:** 877771719\n**M-Pesa:** 842482984\n**Titular:** Kaito Luis\n\nSomente após a confirmação do pagamento a aposta será validada.',
                        color: 0x00FF00,
                        fields: [
                            { name: 'Valor da Aposta', value: `${bet.valor} MZN`, inline: true },
                            { name: 'Modo', value: bet.modo, inline: true }
                        ]
                    },
                    {
                        title: '📝 COMO FUNCIONA',
                        description: '1. Ambos jogadores enviam o valor\n2. Aguarde confirmação do admin\n3. Após confirmado, criem a sala no Free Fire\n4. Joguem a partida\n5. Enviem o print do resultado\n6. O vencedor recebe o prêmio',
                        color: 0x3498DB
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

        // 6. Update Original Message (Disable button)
        return res.status(200).json({
            type: InteractionResponseType.UPDATE_MESSAGE,
            data: {
                content: `Aposta aceita por <@${discordId}>! Canal criado: <#${channel.id}>`,
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
