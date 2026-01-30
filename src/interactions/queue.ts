import { InteractionResponseType } from 'discord-interactions';
import { supabase } from '../utils/supabase.js';
import { rest } from '../utils/discord.js';
import { Routes } from 'discord.js';
// We will need a way to trigger logic when queue is full. 
// Can import a util function for that.
import { handleQueueFull } from '../utils/queueManager.js';

export async function handleQueueInteraction(req: any, res: any, interaction: any) {
    const { message, member, data, custom_id } = interaction;
    const userId = member.user.id;
    const messageId = message.id;

    const action = custom_id; // 'join_queue' or 'leave_queue'

    try {
        // 1. Fetch Queue Data
        const { data: queue, error } = await supabase
            .from('queues')
            .select('*')
            .eq('message_id', messageId)
            .single();

        if (error || !queue) {
            return res.status(200).json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ Fila não encontrada no banco de dados. Tente criar uma nova com /fila.', flags: 64 }
            });
        }

        let currentPlayers = queue.current_players || [];

        if (action === 'join_queue') {
            if (currentPlayers.includes(userId)) {
                return res.status(200).json({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: { content: '⚠️ Você já está nesta fila.', flags: 64 }
                });
            }

            if (currentPlayers.length >= queue.required_players) {
                return res.status(200).json({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: { content: '⚠️ Esta fila acabou de encher!', flags: 64 }
                });
            }

            // Check if in other queues
            const { data: activeQueues } = await supabase
                .from('queues')
                .select('id')
                .contains('current_players', JSON.stringify([userId]));

            if (activeQueues && activeQueues.length > 0) {
                return res.status(200).json({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: { content: '❌ Você já está em outra fila!', flags: 64 }
                });
            }

            currentPlayers.push(userId);

            await supabase
                .from('queues')
                .update({ current_players: currentPlayers })
                .eq('id', queue.id);

            // Respond with Type 7 to update embed instantly
            const embed = generateQueueEmbed(queue, currentPlayers);
            res.status(200).json({
                type: 7, // UPDATE_MESSAGE
                data: { embeds: [embed] }
            });

            // If full, trigger match creation in background
            if (currentPlayers.length >= queue.required_players) {
                handleQueueFull(queue, currentPlayers).catch(err => console.error("Match creation error:", err));
            }
            return;
        }

        if (action === 'leave_queue') {
            if (!currentPlayers.includes(userId)) {
                return res.status(200).json({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: { content: '⚠️ Você não está nesta fila.', flags: 64 }
                });
            }

            currentPlayers = currentPlayers.filter((id: string) => id !== userId);

            await supabase
                .from('queues')
                .update({ current_players: currentPlayers })
                .eq('id', queue.id);

            const embed = generateQueueEmbed(queue, currentPlayers);
            return res.status(200).json({
                type: 7, // UPDATE_MESSAGE
                data: { embeds: [embed] }
            });
        }
    } catch (err) {
        console.error("Queue Interaction Error:", err);
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: '❌ Ocorreu um erro ao processar sua entrada na fila.', flags: 64 }
        });
    }
}

function generateQueueEmbed(queue: any, currentPlayers: string[]) {
    let playersListText = currentPlayers.length === 0
        ? "Nenhum jogador na fila."
        : currentPlayers.map((id, i) => `${i + 1}. <@${id}>`).join('\n');

    const platformText = queue.is_mobile_only ? '📱 MOBILE ONLY' : '💻📱 MISTO (EMULADOR + MOBILE)';
    const color = queue.is_mobile_only ? 0x00FF00 : 0xFFA500;

    return {
        title: `COMBATE ${queue.game_mode} - ${queue.bet_value}MT`,
        description: `**Plataforma:** ${platformText}\n**Valor:** ${queue.bet_value} MT\n**Jogadores:** ${currentPlayers.length}/${queue.required_players}\n\n${playersListText}\n\nClique no botão abaixo para entrar na fila.`,
        color: color,
        footer: { text: 'Sistema de Filas Automáticas' }
    };
}

