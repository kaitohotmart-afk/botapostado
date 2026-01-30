
import { InteractionResponseType, MessageComponentTypes, ButtonStyleTypes } from 'discord-interactions';
import { supabase } from '../utils/supabase.js';
import { rest } from '../utils/discord.js';
import { Routes } from 'discord.js';

export async function handleMatchControl(req: any, res: any, interaction: any) {
    const { member, data, custom_id, channel_id } = interaction;
    const [action, betId] = custom_id.split(':');

    // Permission Check: Mediator or Admin Only
    const isAdmin = (BigInt(member.permissions) & BigInt(8)) !== BigInt(0);
    const hasMediatorRole = member.roles.some((roleId: string) => {
        // We assume we don't have the role name here directly, need to check resolved roles or fetch.
        // For efficiency, checking checking if 'roles' in interaction data resolved, if not we rely on IDs.
        // Assuming we set up a constant or env var for Mediator Role ID would be best.
        // Or we just check "MANAGE_MESSAGES" or similar permissions.
        // User request: "Cargo de Mediador, Administradores".
        // Let's rely on Admin permission for now + try to match name from resolved roles if available.
        return false;
    });

    // NOTE: In a real app we'd fetch the guild roles and check, or store the Mediator Role ID.
    // For now, let's allow Admins.
    // TODO: Add specific Mediator Role ID check if configured.

    if (!isAdmin /* && !hasMediatorRole */) {
        // Try checking resolved roles for "Mediador"
        if (interaction.data.resolved?.roles) {
            const roles = Object.values(interaction.data.resolved.roles) as any[];
            const isMediator = roles.some(r => r.name.toLowerCase().includes('mediador'));
            if (!isMediator) {
                return res.status(200).json({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: { content: '❌ Apenas Mediadores ou Admins podem controlar a aposta.', flags: 64 }
                });
            }
        } else {
            // Fallback for safety
            return res.status(200).json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ Apenas Mediadores ou Admins podem controlar a aposta.', flags: 64 }
            });
        }
    }

    if (action === 'match_cancel') {
        const { error } = await supabase
            .from('bets')
            .update({ status: 'cancelada', finalizado_em: new Date() })
            .eq('id', betId);

        if (error) {
            return res.status(200).json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ Erro ao cancelar aposta.', flags: 64 }
            });
        }

        // Delete Channel after 5 seconds
        setTimeout(() => {
            rest.delete(Routes.channel(channel_id)).catch(console.error);
        }, 5000);

        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: '✅ Aposta cancelada! O canal será excluído em 5 segundos.' }
        });
    }

    if (action === 'match_finalize') {
        // Show a modal to select winner? 
        // Or just components buttons "Time A Wins" / "Time B Wins"?
        // Modal is cleaner for inputting result details, but Buttons are faster.
        // Let's return a new set of buttons to confirm WHO won.

        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: '🏆 **Quem venceu a partida?**',
                components: [
                    {
                        type: MessageComponentTypes.ACTION_ROW,
                        components: [
                            {
                                type: MessageComponentTypes.BUTTON,
                                style: ButtonStyleTypes.PRIMARY,
                                label: 'Vitória Time A',
                                custom_id: `win_team_a:${betId}`,
                            },
                            {
                                type: MessageComponentTypes.BUTTON,
                                style: ButtonStyleTypes.PRIMARY,
                                label: 'Vitória Time B',
                                custom_id: `win_team_b:${betId}`,
                            }
                        ]
                    }
                ],
                flags: 64 // Ephemeral? Maybe public so everyone sees the decision being made.
            }
        });
    }

    if (action === 'win_team_a' || action === 'win_team_b') {
        // Finalize Logic
        const winningTeam = action === 'win_team_a' ? 'A' : 'B';

        // Fetch bet to get players
        const { data: bet } = await supabase.from('bets').select('*').eq('id', betId).single();
        if (!bet) return res.status(200).send({ type: 4, data: { content: "Erro ao buscar aposta." } });

        const winnerTeam = winningTeam === 'A' ? bet.players_data?.teamA : bet.players_data?.teamB;
        const loserTeam = winningTeam === 'A' ? bet.players_data?.teamB : bet.players_data?.teamA;

        // If it's a legacy bet without players_data, fallback to jogador1/2
        const winners = Array.isArray(winnerTeam) ? winnerTeam : [winningTeam === 'A' ? bet.jogador1_id : bet.jogador2_id];
        const losers = Array.isArray(loserTeam) ? loserTeam : [winningTeam === 'A' ? bet.jogador2_id : bet.jogador1_id];

        const { error } = await supabase
            .from('bets')
            .update({
                status: 'finalizada',
                vencedor_id: winners[0], // Keep captain as primary winner for backward compatibility
                finalizado_em: new Date(),
            })
            .eq('id', betId);

        if (error) {
            return res.status(200).json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ Erro ao finalizar aposta.', flags: 64 }
            });
        }

        // Update Stats & Levels for ALL players
        const betValue = Number(bet.valor);
        const winProfit = betValue; // Simple profit calculation for now
        const lossAmount = -betValue;

        const { incrementPlayerStats, updatePlayerLevel } = await import('../utils/levels.js');
        const { sendDM } = await import('../utils/notifications.js');

        await Promise.all([
            ...winners.map(uid =>
                incrementPlayerStats(uid, true, betValue, winProfit)
                    .then(() => updatePlayerLevel(uid, interaction.guild_id))
                    .then(() => sendDM(uid, `🏆 **Vitória Confirmada!**\nSua partida de ${bet.modo} (${bet.valor} MT) foi finalizada e você venceu! 🎉`))
            ),
            ...losers.map(uid =>
                incrementPlayerStats(uid, false, betValue, lossAmount)
                    .then(() => updatePlayerLevel(uid, interaction.guild_id))
                    .then(() => sendDM(uid, `💀 **Fim de Partida**\nSua partida de ${bet.modo} (${bet.valor} MT) foi finalizada. Mais sorte na próxima! ⚔️`))
            )
        ]);

        // Delete Channel after 10 seconds
        setTimeout(() => {
            rest.delete(Routes.channel(channel_id)).catch(console.error);
        }, 10000);

        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: `🏆 **Vitória confirmada para Time ${winningTeam}!**\nCanal será excluído em 10 segundos.` }
        });
    }
}
