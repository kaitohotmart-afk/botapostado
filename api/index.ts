import { VercelRequest, VercelResponse } from '@vercel/node';
import { InteractionType, InteractionResponseType, verifyKey } from 'discord-interactions';
import { handleCommand } from '../src/commands/handler.js';
import { handleComponent } from '../src/interactions/handler.js';

export const config = {
    api: {
        bodyParser: false,
    },
};

async function getRawBody(req: VercelRequest): Promise<string> {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', (chunk) => {
            data += chunk;
        });
        req.on('end', () => {
            resolve(data);
        });
        req.on('error', reject);
    });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).end('Method not allowed');
    }

    const signature = req.headers['x-signature-ed25519'] as string;
    const timestamp = req.headers['x-signature-timestamp'] as string;

    const rawBody = await getRawBody(req);

    const isValidRequest = verifyKey(rawBody, signature, timestamp, process.env.DISCORD_PUBLIC_KEY!);

    if (!isValidRequest) {
        console.error('Invalid signature');
        return res.status(401).end('Bad request signature');
    }

    try {
        const interaction = JSON.parse(rawBody);

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
    } catch (err: any) {
        console.error('Interaction error:', err);
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: `❌ Error de Interação: ${err.message}\n\`\`\`${err.stack?.slice(0, 1000)}\`\`\``,
                flags: 64
            }
        });
    }
}
