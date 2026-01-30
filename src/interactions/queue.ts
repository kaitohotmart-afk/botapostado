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
    const username = member.user.username; // Or global_name
    const messageId = message.id;

    const action = custom_id; // 'join_queue' or 'leave_queue'

    // 1. Fetch Queue Data
    const { data: queue, error } = await supabase
        .from('queues')
        .select('*')
        .eq('message_id', messageId)
        .single();

    if (error || !queue) {
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: '❌ Fila não encontrada no banco de dados.', flags: 64 }
        });
    }

    let currentPlayers = queue.current_players || [];

    if (action === 'join_queue') {
        // Validation: Already in this queue?
        if (currentPlayers.includes(userId)) {
            return res.status(200).json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '⚠️ Você já está nesta fila.', flags: 64 }
            });
        }

        // Validation: Full?
        if (currentPlayers.length >= queue.required_players) {
            return res.status(200).json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '⚠️ Fila cheia! Aguardando processamento...', flags: 64 }
            });
        }

        // Validation: Already in ANY other active queue?
        // Note: This query might be expensive if many queues. 
        // Better to rely on "is_busy" flag in players table if we had one, or query queues where current_players contains userId
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

        // Check active bets? (To be implemented: query 'bets' where status IN ('aguardando', 'em_jogo') AND players_data contains userId)

        // Add User
        currentPlayers.push(userId);

        // Update DB
        await supabase
            .from('queues')
            .update({ current_players: currentPlayers })
            .eq('id', queue.id);

        // Update Embed
        await updateQueueEmbed(queue, currentPlayers, interaction);

        // Check if Full -> Trigger Match
        if (currentPlayers.length >= queue.required_players) {
            // Trigger background process (don't await strictly if it takes time, but Vercel functions are short-lived)
            // We should ideally call this.
            // But we need to respond to the interaction first or simultaneous.
            // Using `waitUntil` context if available, or just calling it.
            // For now, call it.
            // We respond first to avoid timeout? No, we update embed first.

            // Actually, handleQueueFull might reset the queue immediately or create the channel.
            await handleQueueFull(queue, currentPlayers);
        }

        return res.status(200).json({
            type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE
        });
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

        await updateQueueEmbed(queue, currentPlayers, interaction);

        return res.status(200).json({
            type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE
        });
    }
}

async function updateQueueEmbed(queue: any, currentPlayers: string[], interaction: any) {
    // Reconstruct embed
    // Need to fetch user names? Or just count? User names is better.
    // Assuming we can mention them <@id> in description.

    // Formatting list
    let playersListText = currentPlayers.length === 0
        ? "Nenhum jogador na fila."
        : currentPlayers.map((id, i) => `${i + 1}. <@${id}>`).join('\n');

    const platformText = queue.is_mobile_only ? '📱 MOBILE ONLY' : '💻📱 MISTO (EMULADOR + MOBILE)';
    const color = queue.is_mobile_only ? 0x00FF00 : 0xFFA500;

    const embed = {
        title: `COMBATE ${queue.game_mode} - ${queue.bet_value}MT`,
        description: `**Plataforma:** ${platformText}\n**Valor:** ${queue.bet_value} MT\n**Jogadores:** ${currentPlayers.length}/${queue.required_players}\n\n${playersListText}\n\nClique no botão abaixo para entrar na fila.`,
        color: color,
        footer: { text: 'Sistema de Filas Automáticas' }
    };

    // Update message
    await rest.patch(Routes.channelMessage(queue.channel_id, queue.message_id), {
        body: { embeds: [embed] }
    });
}
