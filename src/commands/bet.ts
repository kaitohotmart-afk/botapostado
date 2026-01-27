import { VercelRequest, VercelResponse } from '@vercel/node';
import { InteractionResponseType, MessageComponentTypes, ButtonStyleTypes } from 'discord-interactions';
import { supabase } from '../utils/supabase.js';

export async function handleBetCommand(req: VercelRequest, res: VercelResponse, interaction: any) {
    const { member, data, guild_id } = interaction;
    const adminId = member.user.id;

    // 1. Check if user has permission to create bets
    // Allow if: Administrator permission, or has Dono/botAP role
    const memberRoles = member.roles || [];
    const memberPermissions = member.permissions || '0';

    // Check if user has ADMINISTRATOR permission (bitfield 0x8 = 8)
    const ADMINISTRATOR_PERMISSION = BigInt(8);
    const userPermissions = BigInt(memberPermissions);
    const hasAdminPermission = (userPermissions & ADMINISTRATOR_PERMISSION) !== BigInt(0);

    // Check for specific roles
    let hasAdminRole = false;
    if (interaction.data.resolved?.roles) {
        const roles = interaction.data.resolved.roles;
        hasAdminRole = memberRoles.some((roleId: string) => {
            const role = roles[roleId];
            return role && (role.name === 'Dono' || role.name === 'botAP');
        });
    }

    if (!hasAdminPermission && !hasAdminRole) {
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: '❌ Apenas administradores ou membros com cargo **Dono**/**botAP** podem criar apostas.',
                flags: 64
            }
        });
    }

    // 2. Extract command options
    const modoOption = data.options.find((opt: any) => opt.name === 'modo');
    const valorOption = data.options.find((opt: any) => opt.name === 'valor');
    const modoSalaOption = data.options.find((opt: any) => opt.name === 'modo_sala');

    const modo = modoOption?.value;
    const valor = valorOption?.value;
    const modoSala = modoSalaOption?.value;

    if (!modo || !valor || !modoSala) {
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: '❌ Todos os campos são obrigatórios.',
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
        // 3. Create bet (WITHOUT specific players)
        const { data: bet, error: betError } = await supabase
            .from('bets')
            .insert([{
                criador_admin_id: adminId,
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

        // 4. Send public message with ONE accept button
        const modoSalaText = modoSala === 'full_mobile' ? '📱 FULL MOBILE' : '📱💻 MISTO';
        const modoNome = modo.replace('_', ' ').toUpperCase();

        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: `Nova aposta criada por <@${adminId}>!`,
                embeds: [
                    {
                        title: '🔥 NOVA APOSTA DISPONÍVEL',
                        description: 'Qualquer jogador pode aceitar esta aposta.\n\n⚠️ **Os nomes dos jogadores serão revelados apenas após 2 jogadores aceitarem.**',
                        color: 0xFF6B6B,
                        fields: [
                            { name: 'Modo', value: modoNome, inline: true },
                            { name: 'Valor', value: `${valor} MZN`, inline: true },
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
