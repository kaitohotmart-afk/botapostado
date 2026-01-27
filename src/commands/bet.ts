import { VercelRequest, VercelResponse } from '@vercel/node';
import { InteractionResponseType, MessageComponentTypes, ButtonStyleTypes } from 'discord-interactions';
import { supabase } from '../utils/supabase.js';
import { Player } from '../types.js';

export async function handleBetCommand(req: VercelRequest, res: VercelResponse, interaction: any) {
    const { member, data } = interaction;
    const discordId = member.user.id;
    const username = member.user.username;

    const modoOption = data.options.find((opt: any) => opt.name === 'modo');
    const valorOption = data.options.find((opt: any) => opt.name === 'valor');

    const modo = modoOption?.value;
    const valor = valorOption?.value;

    if (!modo || !valor) {
        return res.status(400).json({ error: 'Missing options' });
    }

    try {
        // 1. Ensure player exists
        let { data: player, error: playerError } = await supabase
            .from('players')
            .select('*')
            .eq('discord_id', discordId)
            .single();

        if (playerError && playerError.code === 'PGRST116') {
            // Player doesn't exist, create one
            const { data: newPlayer, error: createError } = await supabase
                .from('players')
                .insert([{ discord_id: discordId, nome: username }])
                .select()
                .single();

            if (createError) throw createError;
            player = newPlayer;
        } else if (playerError) {
            throw playerError;
        }

        // 2. Create bet
        const { data: bet, error: betError } = await supabase
            .from('bets')
            .insert([
                {
                    criador_id: discordId,
                    modo: modo,
                    valor: valor,
                    status: 'aguardando'
                }
            ])
            .select()
            .single();

        if (betError) throw betError;

        // 3. Respond with Embed and Button
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: `Nova aposta criada por <@${discordId}>!`,
                embeds: [
                    {
                        title: '🔥 NOVA APOSTA DISPONÍVEL',
                        color: 0xFFA500, // Orange
                        fields: [
                            { name: 'Modo', value: modo, inline: true },
                            { name: 'Valor', value: `${valor} MZN`, inline: true },
                            { name: 'Criador', value: `<@${discordId}>`, inline: true },
                            { name: 'Status', value: 'Aguardando Oponente', inline: false }
                        ],
                        footer: { text: `Bet ID: ${bet.id}` }
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
                                emoji: { name: '⚔️' }
                            }
                        ]
                    }
                ]
            }
        });

    } catch (error) {
        console.error('Error creating bet:', error);
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: '❌ Ocorreu um erro ao criar a aposta. Tente novamente mais tarde.',
                flags: 64 // Ephemeral
            }
        });
    }
}
