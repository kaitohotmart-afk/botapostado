import { rest } from './discord.js';
import { Routes, ChannelType, PermissionFlagsBits } from 'discord.js';
import { supabase } from './supabase.js';

const CATEGORY_NAME = 'SISTEMA DE APOSTAS';
const CHANNELS = [
    { name: 'como-funciona', type: ChannelType.GuildText, topic: 'Instruções de como usar o bot de apostas.' },
    { name: 'ranking', type: ChannelType.GuildText, topic: 'Ranking de vitórias e derrotas.' },
    { name: 'criar-aposta', type: ChannelType.GuildText, topic: 'Canal para criar apostas. Apenas comandos "/" são permitidos.' },
    { name: 'apostas-abertas', type: ChannelType.GuildText, topic: 'Canal fixo onde TODAS as apostas criadas aparecem.' }
];

export async function setupGuildChannels(guildId: string) {
    try {
        // 1. Get existing channels
        const existingChannels = await rest.get(Routes.guildChannels(guildId)) as any[];

        // 2. Find or create category (Case Insensitive)
        let category = existingChannels.find(c =>
            c.name.toLowerCase() === CATEGORY_NAME.toLowerCase() &&
            c.type === ChannelType.GuildCategory
        );

        if (!category) {
            console.log(`Creating category: ${CATEGORY_NAME}`);
            category = await rest.post(Routes.guildChannels(guildId), {
                body: {
                    name: CATEGORY_NAME,
                    type: ChannelType.GuildCategory
                }
            });
        }

        // 3. Create or Update channels
        for (const channelDef of CHANNELS) {
            console.error(`Error setting up channels for guild ${guildId}:`, error);
        }
    }

export async function updateInstructions(channelId: string) {
        const embed = {
            title: '📖 COMO FUNCIONA - KAITO FF',
            description: 'Bem-vindo ao sistema de apostas automatizado!',
            color: 0x3498DB,
            fields: [
                {
                    name: '🎮 Como criar uma aposta',
                    value: 'Use o comando `/apostar` no canal <#criar-aposta>. Escolha o modo, valor e estilo da sala.'
                },
                {
                    name: '✅ Como aceitar uma aposta',
                    value: 'Clique no botão **Aceitar Aposta** em qualquer aposta disponível no canal <#apostas-abertas>.'
                },
                {
                    name: '🎮 Limites de Apostas',
                    value: '• **Criação:** Máximo de 2 apostas abertas por jogador.\n• **Participação:** Máximo de 5 apostas simultâneas.\n• **VIP / Diamante:** Criação de apostas ilimitada!'
                },
                {
                    name: '💳 Pagamentos',
                    value: 'Após a aposta ser aceita, um canal privado será criado. Siga as instruções lá para realizar o pagamento.'
                },
                {
                    name: '⚖️ Validação',
                    value: 'O resultado da partida deve ser enviado no canal privado e será validado pela nossa administração.'
                },
                {
                    name: '🚫 Regras e Penalidades',
                    value: '• **BAN AUTOMÁTICO (3 DIAS):** Para quem mandar mais de 5 mensagens normais no canal <#criar-aposta> que não sejam de comandos.\n• Ban para apostas sem sentido ou tentativa de criar chats indevidamente.\n• Se tiver mais de 7 chats ativos sem fechar, você será banido por 1 dia.\n• Respeite os outros jogadores.'
                }
            ],
            footer: { text: 'KAITO FF - O melhor bot de apostas' }
        };

        try {
            // Clear existing messages to avoid duplicates
            const messages = await rest.get(Routes.channelMessages(channelId)) as any[];
            if (messages.length > 0) {
                // Bulk delete if possible, or manual delete
                // For simplicity in this context, let's just delete the last few messages found
                for (const msg of messages) {
                    await rest.delete(Routes.channelMessage(channelId, msg.id));
                }
            }

            await rest.post(Routes.channelMessages(channelId), {
                body: { embeds: [embed] }
            });
        } catch (error) {
            console.error('Error updating instructions:', error);
        }
    }

    export async function updateRanking(channelId: string) {
        try {
            const { data: players, error } = await supabase
                .from('players')
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
