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
    console.log('--- INTERACTION START ---');

    if (req.method !== 'POST') {
        console.log('Method not allowed:', req.method);
        return res.status(405).end('Method not allowed');
    }

    const signature = req.headers['x-signature-ed25519'] as string;
    const timestamp = req.headers['x-signature-timestamp'] as string;
    const publicKey = process.env.DISCORD_PUBLIC_KEY;

    if (!signature || !timestamp || !publicKey) {
        console.error('Missing signature, timestamp or public key');
        return res.status(401).end('Missing verification headers');
    }

    let rawBody = '';

    try {
        // Handle pre-parsed body (Express local or Vercel edge cases)
        if ((req as any).rawBody) {
            rawBody = (req as any).rawBody.toString();
            console.log('Using pre-parsed rawBody, length:', rawBody.length);
        } else if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
            rawBody = JSON.stringify(req.body);
            console.log('Warning: Body was already parsed. Validation might fail if not original raw body.');
        } else {
            rawBody = await getRawBody(req);
            console.log('Body read from stream, length:', rawBody.length);
        }
    } catch (e) {
        console.error('Error extracting body:', e);
        return res.status(500).end('Body extraction failed');
    }

    const isValidRequest = verifyKey(rawBody, signature, timestamp, publicKey);

    if (!isValidRequest) {
        console.error('Invalid request signature');
        return res.status(401).end('Bad request signature');
    }

    try {
        const interaction = JSON.parse(rawBody);
        console.log('Interaction received:', interaction.id, 'Type:', interaction.type);

        if (interaction.type === InteractionType.PING) {
            console.log('Responding to PING');
            return res.status(200).json({ type: InteractionResponseType.PONG });
        }

        if (interaction.type === InteractionType.APPLICATION_COMMAND) {
            console.log('Handling Command:', interaction.data.name);
            return handleCommand(req, res, interaction);
        }

        if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
            console.log('Handling Component:', interaction.data.custom_id);
            return handleComponent(req, res, interaction);
        }

        console.log('Unknown interaction type');
        return res.status(400).end('Unknown interaction type');
    } catch (err: any) {
        console.error('Top-level interaction error:', err);
        return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: `❌ **Falha Crítica na Interação**\nErro: ${err.message}\n\`\`\`${err.stack?.slice(0, 500)}\`\`\``,
                flags: 64
            }
        });
    }
}
