import { VercelRequest, VercelResponse } from '@vercel/node';
import { InteractionResponseType, MessageComponentTypes, ButtonStyleTypes } from 'discord-interactions';
import { supabase } from '../utils/supabase.js';
import { hasCreatorRole } from '../utils/roles.js';
import { rest } from '../utils/discord.js';
import { Routes } from 'discord.js';

export async function handleSetupQueueCommand(req: VercelRequest, res: VercelResponse, interaction: any) {
    const { member, data, guild_id, channel_id } = interaction;

    // 1. Permission Check (Admin, Owner or Mediador)
    const isAdmin = (BigInt(member.permissions) & BigInt(8)) !== BigInt(0);

    // Check if user is the guild owner
    const guild = await rest.get(Routes.guild(guild_id)) as any;
    const isOwner = member.user.id === guild.owner_id;

    // Check for "Mediador" role
    const roles = await rest.get(Routes.guildRoles(guild_id)) as any[];
    let mediadorRole = roles.find(r => r.name.toLowerCase() === 'mediador');

    if (!mediadorRole && isOwner) {
        // Auto-create Mediador role if owner runs the command and it's missing
        try {
            mediadorRole = await rest.post(Routes.guildRoles(guild_id), {
                body: { name: 'Mediador', color: 0x3498db, permissions: '0' }
            }) as any;
            console.log("Created 'Mediador' role.");
        } catch (e) {
            console.error("Failed to create Mediador role:", e);
        }
    }

    const hasMediadorRole = mediadorRole ? member.roles.includes(mediadorRole.id) : false;

    if (!isAdmin && !isOwner && !hasMediadorRole) {
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: '❌ Apenas Mediadores, Administradores ou o Dono do Servidor podem configurar filas.',
                flags: 64
            }
        });
    }

    const modeOption = data.options.find((opt: any) => opt.name === 'mode');
    const valueOption = data.options.find((opt: any) => opt.name === 'value');
    const typeOption = data.options.find((opt: any) => opt.name === 'type'); // 'normal' or 'mixed' (mobile+emu)

    const mode = modeOption?.value; // '1x1', '2x2', etc.
    const betValue = valueOption?.value;
    const isMixed = typeOption?.value === 'mixed'; // Default to normal (maybe mobile only?) user request says "Salas Mistas" vs others.
    // Let's assume 'type' option values: 'mobile', 'mixed'. Or maybe separate command args.
    // User req: "Categoria separada: Salas Mistas (Emulador + Mobile)" vs "Filas 1x1" (implies standard/mobile?)
    // Let's add a 'platform' option: 'mobile' | 'mixed'

    // Correction based on user prompt: "Categoria separada: Salas Mistas"
    // We can just have a 'category' or 'platform' arg.
    const platformOption = data.options.find((opt: any) => opt.name === 'platform');
    const platform = platformOption?.value || 'mobile'; // Default to mobile if not specified? Or enforce.

    const reqPlayersMap: Record<string, number> = {
        '1x1': 2,
        '2x2': 4,
        '3x3': 6,
        '4x4': 8
    };

    const requiredPlayers = reqPlayersMap[mode];

    if (!requiredPlayers) {
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: '❌ Modo inválido. Use 1x1, 2x2, 3x3 ou 4x4.',
                flags: 64
            }
        });
    }

    // 2. Create the Embed Message
    const embedTitle = `COMBATE ${mode} - ${betValue}MT`;
    const platformText = platform === 'mixed' ? '💻📱 MISTO (EMULADOR + MOBILE)' : '📱 MOBILE ONLY';
    const color = platform === 'mixed' ? 0xFFA500 : 0x00FF00; // Orange for Mixed, Green for Mobile?

    // Initial Empty State
    const currentPlayers: string[] = [];
    const playersListText = "Nenhum jogador na fila.";

    const embed = {
        title: embedTitle,
        description: `**Plataforma:** ${platformText}\n**Valor:** ${betValue} MT\n**Jogadores:** 0/${requiredPlayers}\n\n${playersListText}\n\nClique no botão abaixo para entrar na fila.`,
        color: color,
        footer: { text: 'Sistema de Filas Automáticas' }
    };

    try {
        // Send message to channel
        const message = await rest.post(Routes.channelMessages(channel_id), {
            body: {
                embeds: [embed],
                components: [
                    {
                        type: MessageComponentTypes.ACTION_ROW,
                        components: [
                            {
                                type: MessageComponentTypes.BUTTON,
                                style: ButtonStyleTypes.PRIMARY,
                                label: 'Entrar na Fila',
                                custom_id: `join_queue`, // We will append queue_id logic via state or just lookup by message_id
                                emoji: { name: '🎮' }
                            },
                            {
                                type: MessageComponentTypes.BUTTON,
                                style: ButtonStyleTypes.DANGER,
                                label: 'Sair',
                                custom_id: `leave_queue`,
                                emoji: { name: '🚪' }
                            }
                        ]
                    }
                ]
            }
        }) as any;

        // 3. Save to Database
        const { error } = await supabase
            .from('queues')
            .insert([{
                guild_id,
                channel_id,
                message_id: message.id,
                game_mode: mode,
                bet_value: betValue,
                required_players: requiredPlayers,
                current_players: [],
                is_mobile_only: platform !== 'mixed',
                status: 'active'
            }]);

        if (error) {
            console.error('DB Error:', error);
            // Delete message if DB fails?
            await rest.delete(Routes.channelMessage(channel_id, message.id));
            throw error;
        }

        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: `✅ Fila **${mode} ${betValue}MT** criada com sucesso!`,
                flags: 64 // Ephemeral
            }
        });

    } catch (e) {
        console.error(e);
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: '❌ Erro ao criar fila.',
                flags: 64
            }
        });
    }
}
