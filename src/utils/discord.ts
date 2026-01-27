import { REST } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DISCORD_TOKEN) {
    console.error('Missing Discord Token');
}

export const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
