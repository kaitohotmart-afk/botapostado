import { VercelRequest, VercelResponse } from '@vercel/node';
import { InteractionResponseType } from 'discord-interactions';
import { handleAcceptBet } from './acceptBet.js';
import { handleAdminAction, handleSelectWinner, handleCloseChannel, handleSelectWinnerType } from './adminActions.js';

export async function handleComponent(req: VercelRequest, res: VercelResponse, interaction: any) {
    const { custom_id } = interaction.data;

    if (custom_id.startsWith('accept_bet:')) {
        const betId = custom_id.split(':')[1];
        return handleAcceptBet(req, res, interaction, betId);
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

    return res.status(200).json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: 'Interação recebida! (Em desenvolvimento)',
        },
    });
}
