import { VercelRequest, VercelResponse } from '@vercel/node';
import { InteractionResponseType, MessageComponentTypes, ButtonStyleTypes } from 'discord-interactions';
import { supabase } from '../utils/supabase.js';

export async function handleBetCommand(req: VercelRequest, res: VercelResponse, interaction: any) {
    const { member, data, guild_id } = interaction;
    const adminId = member.user.id;
    const adminUsername = member.user.username;

    // 1. Check if user has DONO or botAP role
    const memberRoles = member.roles || [];
    const hasAdminRole = memberRoles.some((roleId: string) => {
        const role = interaction.data.resolved?.roles?.[roleId];
        return role && (role.name === 'Dono' || role.name === 'botAP');
    });

    // Alternative: Check by fetching roles from guild (more reliable)
    // For now, we'll check the member.roles array against guild roles
    // Note: In HTTP Interactions, we need to check against resolved data

    if (!hasAdminRole) {
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: '❌ Apenas membros com cargo **Dono** ou **botAP** podem criar apostas.',
                flags: 64 // Ephemeral
            }
        });
    }

    // 2. Extract command options
    const player1Option = data.options.find((opt: any) => opt.name === 'jogador1');
    const player2Option = data.options.find((opt: any) => opt.name === 'jogador2');
    const modoOption = data.options.find((opt: any) => opt.name === 'modo');
    const valorOption = data.options.find((opt: any) => opt.name === 'valor');
    const modoSalaOption = data.options.find((opt: any) => opt.name === 'modo_sala');

    const player1Id = player1Option?.value;
    const player2Id = player2Option?.value;
    const modo = modoOption?.value;
    const valor = valorOption?.value;
    const modoSala = modoSalaOption?.value;

    // 3. Validation
    if (!player1Id || !player2Id || !modo || !valor || !modoSala) {
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: '❌ Todos os campos são obrigatórios.',
                flags: 64
            }
        });
    }

    if (player1Id === player2Id) {
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: '❌ Os dois jogadores não podem ser a mesma pessoa.',
                flags: 64
            }
        });
    }

    if (valor < 25) {
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: '❌ O valor mínimo da aposta é 25 MZN.',
                flags: 64
            }
        });
    }

    try {
        // 4. Ensure both players exist in players table
        for (const playerId of [player1Id, player2Id]) {
            const playerData = data.resolved.users[playerId];
            const { error: playerError } = await supabase
                .from('players')
                .select('*')
                .eq('discord_id', playerId)
                .single();

            if (playerError && playerError.code === 'PGRST116') {
                await supabase.from('players').insert([{
                    discord_id: playerId,
                    nome: playerData?.username || 'Unknown'
                }]);
            }
        }

        // 5. Create bet
        const { data: bet, error: betError } = await supabase
            .from('bets')
            .insert([{
                criador_admin_id: adminId,
                jogador1_id: player1Id,
                jogador2_id: player2Id,
                modo: modo,
                valor: valor,
                modo_sala: modoSala,
                status: 'aguardando',
                jogador1_aceitou: false,
                jogador2_aceitou: false
            }])
            .select()
            .single();

        if (betError) throw betError;

        // 6. Send message with acceptance buttons (ANONYMOUS)
        const modoSalaText = modoSala === 'full_mobile' ? '📱 FULL MOBILE' : '📱💻 MISTO';
        const modoNome = modo.replace('_', ' ').toUpperCase();

        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: `Nova aposta criada por <@${adminId}>!`,
                embeds: [
                    {
                        title: '🔥 NOVA APOSTA DISPONÍVEL',
                        description: 'Dois jogadores foram convocados para esta partida.\n\n⚠️ **Os nomes dos adversários serão revelados apenas após ambos aceitarem.**',
                        color: 0xFF6B6B,
                        fields: [
                            { name: 'Modo', value: modoNome, inline: true },
                            { name: 'Valor', value: `${valor} MZN`, inline: true },
                            { name: 'Tipo de Sala', value: modoSalaText, inline: true },
                            { name: 'Status', value: '⏳ Aguardando Aceitação (0/2)', inline: false },
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
                                emoji: { name: '✅' }
                            },
                            {
                                type: MessageComponentTypes.BUTTON,
                                style: ButtonStyleTypes.SUCCESS,
                                label: 'Jogador 2: Aceitar',
                                custom_id: `accept_bet_p2:${bet.id}`,
                                emoji: { name: '✅' }
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
                content: '❌ Erro ao criar aposta. Tente novamente.',
                flags: 64
            }
        });
    }
}
