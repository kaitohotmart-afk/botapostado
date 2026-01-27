import { VercelRequest, VercelResponse } from '@vercel/node';
import { InteractionType, InteractionResponseType, verifyKey } from 'discord-interactions';
import { handleCommand } from '../src/commands/handler.js';
import { handleComponent } from '../src/interactions/handler.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const signature = req.headers['x-signature-ed25519'] as string;
    const timestamp = req.headers['x-signature-timestamp'] as string;
    const rawBody = JSON.stringify(req.body);

    if (!signature || !timestamp || !verifyKey(rawBody, signature, timestamp, process.env.DISCORD_PUBLIC_KEY!)) {
        return res.status(401).end('Bad request signature');
    }

    const interaction = req.body;

    if (interaction.type === InteractionType.PING) {
        return res.status(200).json({ type: InteractionResponseType.PONG });
    }

    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
        return handleCommand(req, res, interaction);
    }

    if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
        return handleComponent(req, res, interaction);
    }

    return res.status(400).end('Unknown interaction type');
}
