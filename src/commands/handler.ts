import { VercelRequest, VercelResponse } from '@vercel/node';
import { InteractionResponseType } from 'discord-interactions';
import { handleBetCommand } from './bet.js';
import { handleLeaderboardCommand } from './leaderboard.js';
import { handleProfileCommand } from './profile.js';
import { handlePanelCommand } from './panel.js';

export async function handleCommand(req: VercelRequest, res: VercelResponse, interaction: any) {
    const { name } = interaction.data;

    if (name === 'apostar') {
        return handleBetCommand(req, res, interaction);
    }

    if (name === 'ranking') {
        return handleLeaderboardCommand(req, res, interaction);
    }

    if (name === 'perfil') {
        return handleProfileCommand(req, res, interaction);
    }

    if (name === 'painel') {
        return handlePanelCommand(req, res, interaction);
    }

    if (name === 'fila') {
        const { handleSetupQueueCommand } = await import('./setupQueue.js');
        return handleSetupQueueCommand(req, res, interaction);
    }

    return res.status(400).json({ error: 'Unknown command' });
}
