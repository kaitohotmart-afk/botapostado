import { VercelRequest, VercelResponse } from '@vercel/node';
import { InteractionResponseType, MessageComponentTypes, ButtonStyleTypes } from 'discord-interactions';
import { supabase } from '../utils/supabase.js';
import { hasCreatorRole, removeCreatorRole } from '../utils/roles.js';
import { isPlayerBlocked } from '../utils/faults.js';

export async function handleBetCommand(req: VercelRequest, res: VercelResponse, interaction: any) {
    const { member, data, guild_id } = interaction;
    const adminId = member.user.id;

    // 1. Check if user has permission to create bets
    // Allow if: Administrator permission, or has Dono/botAP/Diamante role, or has "Criador de Apostas" role
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
            return role && (role.name === 'Dono' || role.name === 'botAP' || role.name === 'Diamante');
        });
    }

    const isCreator = await hasCreatorRole(guild_id, member);

    if (!hasAdminPermission && !hasAdminRole && !isCreator) {
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: '❌ Apenas administradores, membros com cargo **Dono**/**botAP**, **Diamante** ou **Criador de Apostas** podem criar apostas.',
                flags: 64
            }
        });
    }

    // 2. Anti-Spam Check: Limit of 2 active bets for non-admins
    if (!hasAdminPermission && !hasAdminRole) {
        const { count, error: countError } = await supabase
            .from('bets')
            .select('*', { count: 'exact', head: true })
            .eq('criador_admin_id', adminId)
            .not('status', 'in', '("finalizada", "cancelada")');

        if (countError) {
            console.error('Error counting active bets:', countError);
        } else if (count !== null && count >= 2) {
            return res.status(200).json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: '❌ Você já tem 2 apostas pendentes. Finalize ou cancele uma para criar outra.',
                    flags: 64
                }
            });
        }
    }

    // 2.1 Block Check
    const blockStatus = await isPlayerBlocked(adminId);
    if (blockStatus.blocked) {
        const untilDate = new Date(blockStatus.until!).toLocaleString('pt-MZ');
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: `❌ Você está bloqueado de criar apostas até **${untilDate}** devido ao acúmulo de faltas.`,
                flags: 64
            }
        });
    }

    // 2. Extract command options
    const modoOption = data.options.find((opt: any) => opt.name === 'modo');
    const valorOption = data.options.find((opt: any) => opt.name === 'valor');
    const modoSalaOption = data.options.find((opt: any) => opt.name === 'modo_sala');
    const estiloSalaOption = data.options.find((opt: any) => opt.name === 'estilo_sala');

    const modo = modoOption?.value;
    const valor = valorOption?.value;
    const modoSala = modoSalaOption?.value;
    const estiloSala = estiloSalaOption?.value;

    if (!modo || !valor || !modoSala || !estiloSala) {
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
                estilo_sala: estiloSala,
                status: 'aguardando',
                jogador1_aceitou: false,
                jogador2_aceitou: false
            }])
            .select()
            .single();

        if (betError) throw betError;

        // 4. Check if we should remove the "Criador de Apostas" role
        if (!hasAdminPermission && !hasAdminRole) {
            const { count } = await supabase
                .from('bets')
                .select('*', { count: 'exact', head: true })
                .eq('criador_admin_id', adminId)
                .not('status', 'in', '("finalizada", "cancelada")');

            if (count !== null && count >= 2) {
                await removeCreatorRole(guild_id, adminId);
            }
        }

        // 5. Send public message with ONE accept button
        const modoSalaText = modoSala === 'full_mobile' ? '📱 FULL MOBILE' : '📱💻 MISTO';
        const modoNome = modo.replace('_', ' ').toUpperCase();
        const estiloSalaText = estiloSala === 'tatico' ? '🎯 TÁTICO' : '🎮 NORMAL';

        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: `🚨 **Nova aposta disponível!** @everyone\nTipo: **${modoNome}**\nModo: **${estiloSalaText}**\nValor: **${valor}MT**`,
                embeds: [
                    {
                        title: '🔥 NOVA APOSTA DISPONÍVEL',
                        description: 'Qualquer jogador pode aceitar esta aposta.\n\n⚠️ **Os nomes dos jogadores serão revelados apenas após 2 jogadores aceitarem.**',
                        color: 0xFF6B6B,
                        fields: [
                            { name: 'Modo', value: modoNome, inline: true },
                            { name: 'Valor', value: `${valor} MZN`, inline: true },
                            { name: 'Tipo de Sala', value: modoSalaText, inline: true },
                            { name: 'Estilo', value: estiloSalaText, inline: true },
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
