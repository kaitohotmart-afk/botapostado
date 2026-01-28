import { rest } from './discord.js';
import { Routes, ChannelType, PermissionFlagsBits } from 'discord.js';
import { supabase } from './supabase.js';

const CATEGORY_NAME = 'SISTEMA DE APOSTAS';
const CHANNELS = [
    { name: 'como-funciona', type: ChannelType.GuildText, topic: 'Instruções de como usar o bot de apostas.' },
    { name: 'ranking', type: ChannelType.GuildText, topic: 'Ranking de vitórias e derrotas.' },
                .select('nome, vitorias, derrotas')
        .order('vitorias', { ascending: false })
        .limit(10);

if (error) throw error;

const embed = {
    title: '🏆 RANKING DE JOGADORES',
    description: 'Os 10 melhores jogadores baseados em vitórias.',
    color: 0xF1C40F,
    fields: players.map((p: any, i: number) => ({
        name: `${i + 1}. ${p.nome}`,
        value: `Vitórias: **${p.vitorias}** | Derrotas: **${p.derrotas}**`,
        inline: false
    })),
    timestamp: new Date().toISOString(),
    footer: { text: 'KAITO FF - Desempenho em Partidas' }
};

// Delete old messages first to keep it clean
const messages = await rest.get(Routes.channelMessages(channelId)) as any[];
for (const msg of messages) {
    await rest.delete(Routes.channelMessage(channelId, msg.id));
}

await rest.post(Routes.channelMessages(channelId), {
    body: { embeds: [embed] }
});
        } catch (error) {
    console.error('Error updating ranking:', error);
}
    }
