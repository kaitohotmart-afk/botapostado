import { VercelRequest, VercelResponse } from '@vercel/node';
import { InteractionResponseType, MessageComponentTypes, ButtonStyleTypes } from 'discord-interactions';
import { supabase } from '../utils/supabase.js';
import { hasCreatorRole, removeCreatorRole } from '../utils/roles.js';
import { isPlayerBlocked } from '../utils/faults.js';
import { rest } from '../utils/discord.js';
import { Routes } from 'discord.js';

export async function handleBetCommand(req: VercelRequest, res: VercelResponse, interaction: any) {
    const { member, data, guild_id } = interaction;
    const adminId = member.user.id;

    // 1. Check if user is Admin (for 0/2 logic)
    const memberRoles = member.roles || [];
    const memberPermissions = member.permissions || '0';
    const ADMINISTRATOR_PERMISSION = BigInt(8);
    const userPermissions = BigInt(memberPermissions);
    const hasAdminPermission = (userPermissions & ADMINISTRATOR_PERMISSION) !== BigInt(0);

    let hasAdminRole = false;
    if (interaction.data.resolved?.roles) {
        const roles = interaction.data.resolved.roles;
        hasAdminRole = memberRoles.some((roleId: string) => {
            const role = roles[roleId];
            return role && (role.name === 'Dono' || role.name === 'botAP');
        });
    }

    const isAdmin = hasAdminPermission || hasAdminRole;

    // 1.1 Configure Channel Permissions (Ensure only slash commands are allowed)
    try {
        const channelId = interaction.channel_id;
        // SEND_MESSAGES: 0x800 (2048)
        // USE_APPLICATION_COMMANDS: 0x80000000 (2147483648)
        // We want to DENY SEND_MESSAGES and ALLOW USE_APPLICATION_COMMANDS for @everyone
        await rest.put(Routes.channelPermission(channelId, guild_id), {
            body: {
                type: 0, // role (@everyone)
                allow: '2147483648', // USE_APPLICATION_COMMANDS
                deny: '2048' // SEND_MESSAGES
            }
        });
    } catch (error) {
        console.error('Error configuring channel permissions:', error);
        // We continue even if this fails, as it's a non-critical UX improvement
    }

    // 2. Anti-Spam Check: Limit of 2 active bets for non-admins
    if (!isAdmin) {
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
        // 3. Create bet
        const insertData: any = {
            criador_admin_id: adminId,
            modo: modo,
            valor: valor,
            modo_sala: modoSala,
            estilo_sala: estiloSala,
            status: 'aguardando',
            jogador1_aceitou: false,
            jogador2_aceitou: false
        };

        // If it's a player creating (not admin), they are automatically jogador1
        if (!isAdmin) {
            insertData.jogador1_id = adminId;
            insertData.jogador1_aceitou = true;
        }

        const { data: bet, error: betError } = await supabase
            .from('bets')
            .insert([insertData])
            .select()
            .single();

        if (betError) throw betError;

        // 4. Check if we should remove the "Criador de Apostas" role
        if (!isAdmin) {
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
        const statusText = isAdmin ? '⏳ Aguardando Jogadores (0/2)' : '⏳ Aguardando adversário (1/2)';
        const embedDescription = isAdmin
            ? 'Qualquer jogador pode aceitar esta aposta.\n\n⚠️ **Os nomes dos jogadores serão revelados apenas após 2 jogadores aceitarem.**'
            : `Aposta criada por <@${adminId}>. Aguardando um adversário para aceitar.\n\n⚠️ **Os nomes dos jogadores serão revelados apenas após o adversário aceitar.**`;

        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: `🚨 **Nova aposta disponível!** @everyone\nTipo: **${modoNome}**\nModo: **${estiloSalaText}**\nValor: **${valor}MT**`,
                embeds: [
                    {
                        title: '🔥 NOVA APOSTA DISPONÍVEL',
                        description: embedDescription,
                        color: 0xFF6B6B,
                        fields: [
                            { name: 'Modo', value: modoNome, inline: true },
                            { name: 'Valor', value: `${valor} MZN`, inline: true },
                            { name: 'Tipo de Sala', value: modoSalaText, inline: true },
                            { name: 'Estilo', value: estiloSalaText, inline: true },
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
