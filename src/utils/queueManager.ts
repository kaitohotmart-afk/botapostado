
import { supabase } from './supabase.js';
import { rest } from './discord.js';
import { Routes, ChannelType, PermissionFlagsBits } from 'discord.js';
import { MessageComponentTypes, ButtonStyleTypes } from 'discord-interactions';

export async function handleQueueFull(queue: any, players: string[]) {
    // 1. Double check if we still have the players (concurrency check)
    // For now, assume passed players list is accurate enough or re-fetch.

    // 2. Clear Queue immediately to allow new people?
    // User Requirement: "Reseta automaticamente a fila, deixando ela vazia e pronta para novos jogadores"
    // So we reset the DB state for the queue.
    await supabase.from('queues').update({ current_players: [] }).eq('id', queue.id);

    // Also update the message to empty (This acts as the "Reset")
    // We can call updateQueueEmbed here or let the interaction handler do the last update.
    // The interaction handler triggered this, so it might have just updated the embed TO FULL.
    // We need to update it BACK TO EMPTY.
    // Let's do a quick update to empty.
    await resetQueueEmbed(queue);

    // 3. Create Match Channel
    const guildId = queue.guild_id;
    // Find Category "APOSTAS EM ANDAMENTO"
    // We might need to cache this ID or search every time.
    const channels = await rest.get(Routes.guildChannels(guildId)) as any[];
    const categoryName = 'APOSTAS EM ANDAMENTO';
    let category = channels.find(c => c.name.toUpperCase() === categoryName && c.type === 4); // 4 = Category

    if (!category) {
        // Create Category if not exists?
        category = await rest.post(Routes.guildChannels(guildId), {
            body: { name: categoryName, type: 4 }
        }) as any;
    }

    const mode = queue.game_mode; // 1x1, 2x2
    const value = queue.bet_value;

    // Teams Logic
    // If 1x1: P1 vs P2
    // If 2x2: P1,P2 vs P3,P4 (Simple split for now, maybe random later?)
    // Simple split:
    const mid = Math.ceil(players.length / 2);
    const teamA = players.slice(0, mid);
    const teamB = players.slice(mid);

    const matchName = `${mode}-${value}-match-${Date.now().toString().slice(-4)}`;

    // Create Channel
    const permissionOverwrites = [
        { id: guildId, deny: ['1024'] }, // @everyone: ViewChannel (1024) DENY (Use string '1024' or bitfield)
        // Bot (self) - implied usually, but good to add
        // Mediator Role? Need ID. 
        // Players:
        ...players.map(pid => ({ id: pid, allow: ['1024', '2048', '32768'] })), // View, Send, Attach Files
    ];

    // Need to find 'Mediador' role ID
    const roles = await rest.get(Routes.guildRoles(guildId)) as any[];
    const mediatorRole = roles.find(r => r.name.toLowerCase() === 'mediador' || r.name.toLowerCase() === 'mediadores');
    if (mediatorRole) {
        permissionOverwrites.push({ id: mediatorRole.id, allow: ['1024', '2048', '32768'] });
    }

    // Note: Discord API ViewChannel = 0x400 (1024)

    const channel: any = await rest.post(Routes.guildChannels(guildId), {
        body: {
            name: matchName,
            type: 0, // Guild Text
            parent_id: category.id,
            permission_overwrites: permissionOverwrites
        }
    });

    // 4. Create Bet in DB
    const { data: bet, error } = await supabase.from('bets').insert([{
        modo: mode,
        valor: value,
        status: 'em_jogo', // Directly to in-game? Or 'aguardando' confirmation? 
        // User says: "O bot cria um canal privado de aposta... Remove os jogadores da fila... Reseta".
        // "Assim que o canal for criado, o bot deve... Enviar uma mensagem inicial... Botões... Finalizar/Cancelar".
        // Implies we are live.
        jogador1_id: teamA[0], // Captains
        jogador2_id: teamB[0],
        players_data: { teamA, teamB },
        queue_id: queue.id,
        channel_pagamento_id: channel.id // Storing channel ID here loosely or make new column? 
        // Schema has 'canal_pagamento_id' - reusable for this channel ID.
    }]).select().single();

    if (error) {
        console.error("Failed to create bet in DB", error);
        await rest.post(Routes.channelMessages(channel.id), { body: { content: "⚠️ Erro ao registrar aposta no banco de dados. Contate um admin." } });
    }

    // 5. Send Control Panel to Channel
    const playersMentions = players.map(p => `<@${p}>`).join(' ');

    await rest.post(Routes.channelMessages(channel.id), {
        body: {
            content: `${playersMentions}\n**Aposta Criada!**\nModo: ${mode}\nValor: ${value}MT`,
            embeds: [{
                title: "Painel da Aposta",
                description: "Use os botões abaixo para gerenciar a partida.\nApenas **Mediadores** ou **Admins** podem usar estes botões.",
                color: 0x3498db,
                fields: [
                    { name: 'Time A', value: teamA.map(p => `<@${p}>`).join('\n'), inline: true },
                    { name: 'Time B', value: teamB.map(p => `<@${p}>`).join('\n'), inline: true },
                ]
            }],
            components: [
                {
                    type: MessageComponentTypes.ACTION_ROW,
                    components: [
                        {
                            type: MessageComponentTypes.BUTTON,
                            style: ButtonStyleTypes.SUCCESS,
                            label: 'Finalizar Aposta',
                            custom_id: `match_finalize:${bet?.id}`,
                            emoji: { name: '✅' }
                        },
                        {
                            type: MessageComponentTypes.BUTTON,
                            style: ButtonStyleTypes.DANGER,
                            label: 'Cancelar Aposta',
                            custom_id: `match_cancel:${bet?.id}`,
                            emoji: { name: '❌' }
                        }
                    ]
                }
            ]
        }
    });

    // Ping Mediator
    if (mediatorRole) {
        await rest.post(Routes.channelMessages(channel.id), {
            body: { content: `<@&${mediatorRole.id}> Uma nova aposta requer supervisão.` }
        });
    }

    // 6. Send "How to Report" info? (Comprovativos etc) - Implicit in user request "Permissões... Envio de imagens"
}

async function resetQueueEmbed(queue: any) {
    const platformText = queue.is_mobile_only ? '📱 MOBILE ONLY' : '💻📱 MISTO (EMULADOR + MOBILE)';
    const color = queue.is_mobile_only ? 0x00FF00 : 0xFFA500;

    const embed = {
        title: `COMBATE ${queue.game_mode} - ${queue.bet_value}MT`,
        description: `**Plataforma:** ${platformText}\n**Valor:** ${queue.bet_value} MT\n**Jogadores:** 0/${queue.required_players}\n\nNenhum jogador na fila.\n\nClique no botão abaixo para entrar na fila.`,
        color: color,
        footer: { text: 'Sistema de Filas Automáticas' }
    };

    await rest.patch(Routes.channelMessage(queue.channel_id, queue.message_id), {
        body: { embeds: [embed] }
    });
}
