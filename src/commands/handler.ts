import { VercelRequest, VercelResponse } from '@vercel/node';
import { InteractionResponseType } from 'discord-interactions';
import { handleBetCommand } from './bet.js';
import { handleLeaderboardCommand } from './leaderboard.js';
import { handleProfileCommand } from './profile.js';
import { handlePanelCommand } from './panel.js';

export async function handleCommand(req: VercelRequest, res: VercelResponse, interaction: any) {
    const { name } = interaction.data;

    if (name === 'apostar') {
        // CRITICAL: Defer reply BEFORE processing
        res.status(200).json({
            type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
            data: { flags: 64 }
        });
        // Don't return - response already sent
        await handleBetCommand(req, res, interaction);
        return;
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
        // CRITICAL: Defer reply BEFORE dynamic import to prevent timeout
        res.status(200).json({
            type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
            data: { flags: 64 }
        });

        // Don't return - response already sent
        const { handleSetupQueueCommand } = await import('./setupQueue.js');
        await handleSetupQueueCommand(req, res, interaction);
        return;
    }

    return res.status(400).json({ error: 'Unknown command' });
}
