import { VercelRequest, VercelResponse } from '@vercel/node';
import { InteractionResponseType, MessageComponentTypes, ButtonStyleTypes } from 'discord-interactions';
import { supabase } from '../utils/supabase.js';
import { hasCreatorRole, removeCreatorRole } from '../utils/roles.js';
import { isPlayerBlocked, checkAndApplyActiveChatBan } from '../utils/faults.js';
import { rest } from '../utils/discord.js';
import { Routes } from 'discord.js';

import { setupGuildChannels } from '../utils/setup.js';

export async function handleBetCommand(req: VercelRequest, res: VercelResponse, interaction: any) {
    const { member, data, guild_id } = interaction;
    const adminId = member.user.id;

    // Ensure channels exist
    await setupGuildChannels(guild_id);

    // 1. Check if user is Admin or has Special Role (VIP, Diamante)
    const memberRoles = member.roles || [];
    const memberPermissions = member.permissions || '0';
    const ADMINISTRATOR_PERMISSION = BigInt(8);
    const userPermissions = BigInt(memberPermissions);
    const hasAdminPermission = (userPermissions & ADMINISTRATOR_PERMISSION) !== BigInt(0);

    let hasStaffRole = false;
    let hasVipRole = false;

    if (interaction.data.resolved?.roles) {
        const roles = interaction.data.resolved.roles;
        memberRoles.forEach((roleId: string) => {
            const role = roles[roleId];
            if (!role) return;
            const roleName = role.name.toLowerCase();
            if (roleName === 'dono' || roleName === 'botap' || roleName === 'staff' || roleName === 'admin') {
                hasStaffRole = true;
            }
            if (roleName === 'vip' || roleName === 'diamante') {
                hasVipRole = true;
            }
        });
    }

    const isStaff = hasAdminPermission || hasStaffRole;
    const isPrivileged = isStaff || hasVipRole;

    // 2. Anti-Spam Check: REMOVED as per user request
    // Users can now create unlimited bets.

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

    // 2.2 Active Chat Limit Check (Penalty)
    const chatBanStatus = await checkAndApplyActiveChatBan(adminId);
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

        // If it's NOT staff creating, they are automatically jogador1
        if (!isStaff) {
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
        // REMOVED: Limits are gone, so we don't need to remove the role based on count.

        // 5. Send public message to #apostas-abertas
        const modoSalaText = modoSala === 'full_mobile' ? '📱 FULL MOBILE' : '📱💻 MISTO';
        const modoNome = modo.replace('_', ' ').toUpperCase();
        const estiloSalaText = estiloSala === 'tatico' ? '🎯 TÁTICO' : '🎮 NORMAL';
        const statusText = isStaff ? '⏳ Aguardando Jogadores (0/2)' : '⏳ Aguardando adversário (1/2)';
        const embedDescription = isStaff
            ? 'Qualquer jogador pode aceitar esta aposta.\n\n⚠️ **Os nomes dos jogadores serão revelados apenas após 2 jogadores aceitarem.**'
            : `Aposta criada por <@${adminId}>. Aguardando um adversário para aceitar.\n\n⚠️ **Os nomes dos jogadores serão revelados apenas após o adversário aceitar.**`;

        // Find #apostas-abertas channel
        const channels = await rest.get(Routes.guildChannels(guild_id)) as any[];
        const publicChannel = channels.find(c => c.name === 'apostas-abertas');

        if (publicChannel) {
            await rest.post(Routes.channelMessages(publicChannel.id), {
                body: {
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
        }

        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: `✅ **Aposta criada com sucesso!**\nEla foi postada no canal <#${publicChannel?.id || 'apostas-abertas'}>.`,
                flags: 64
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
