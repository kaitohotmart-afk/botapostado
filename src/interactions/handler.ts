import { VercelRequest, VercelResponse } from '@vercel/node';
import { InteractionResponseType } from 'discord-interactions';
import { handleAcceptBet } from './acceptBet.js';
import { handleCancelBet } from './cancelBet.js';
import { handleAdminAction, handleSelectWinner, handleCloseChannel, handleSelectWinnerType, handlePaymentMethod } from './adminActions.js';

export async function handleComponent(req: VercelRequest, res: VercelResponse, interaction: any) {
    const { custom_id } = interaction.data;

    if (custom_id.startsWith('accept_bet:')) {
        const betId = custom_id.split(':')[1];
        return handleAcceptBet(req, res, interaction, betId);
    }

    if (custom_id.startsWith('payment_method:')) {
        const [_, admin, betId] = custom_id.split(':');
        return handlePaymentMethod(req, res, interaction, admin, betId);
    }

    if (custom_id.startsWith('cancel_bet:')) {
        const betId = custom_id.split(':')[1];
        return handleCancelBet(req, res, interaction, betId);
    }

    if (custom_id.startsWith('confirm_payment:') || custom_id.startsWith('start_match:') || custom_id.startsWith('finish_bet:')) {
        const [action, betId] = custom_id.split(':');
        return handleAdminAction(req, res, interaction, action, betId);
    }

    if (custom_id.startsWith('select_winner_type:')) {
        const [_, betId, type] = custom_id.split(':');
        return handleSelectWinnerType(req, res, interaction, betId, type);
    }

    if (custom_id.startsWith('select_winner:')) {
        const [_, betId, winnerId, type] = custom_id.split(':');
        return handleSelectWinner(req, res, interaction, betId, winnerId, type);
    }

    if (custom_id.startsWith('close_channel:')) {
        const channelId = custom_id.split(':')[1];
        return handleCloseChannel(req, res, interaction, channelId);
    }

    // New Queue System
    if (custom_id === 'join_queue' || custom_id === 'leave_queue') {
        const { handleQueueInteraction } = await import('./queue.js');
        return handleQueueInteraction(req, res, interaction);
    }

    if (custom_id.startsWith('join_team:')) {
        const { handleTeamSelection } = await import('./teamSelection.js');
        return handleTeamSelection(req, res, interaction);
    }

    if (custom_id.startsWith('match_') || ((custom_id.startsWith('win_team_a') || custom_id.startsWith('win_team_b')) && !custom_id.includes(':select_winner:'))) {
        // match_finalize, match_cancel, win_team_a, win_team_b
        const { handleMatchControl } = await import('./matchControl.js');
        return handleMatchControl(req, res, interaction);
    }

    // Panel Buttons
    if (custom_id === 'btn_profile') {
        const { handleProfileCommand } = await import('../commands/profile.js');
        return handleProfileCommand(req, res, { ...interaction, data: { options: [] } });
    }

    if (custom_id === 'btn_ranking_queues') {
        const { handleLeaderboardCommand } = await import('../commands/leaderboard.js');
        return handleLeaderboardCommand(req, res, { ...interaction, data: { options: [{ value: 'filas' }] } });
    }

    if (custom_id === 'btn_ranking_general') {
        const { handleLeaderboardCommand } = await import('../commands/leaderboard.js');
        return handleLeaderboardCommand(req, res, { ...interaction, data: { options: [{ value: 'general' }] } });
    }

    return res.status(200).json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: 'Interação recebida! (Em desenvolvimento)',
        },
    });
}
