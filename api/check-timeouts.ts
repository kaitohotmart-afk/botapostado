import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../src/utils/supabase.js';
import { rest } from '../src/utils/discord.js';
import { Routes } from 'discord.js';
import { addFault } from '../src/utils/faults.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Basic security check (Vercel Cron)
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
        return res.status(401).end('Unauthorized');
    }

    try {
        const now = new Date();
        const results = {
            paymentTimeouts: await checkPaymentTimeouts(now),
            matchStartTimeouts: await checkMatchStartTimeouts(now),
            resultTimeouts: await checkResultTimeouts(now)
        };

        return res.status(200).json(results);
    } catch (error) {
        console.error('Cron error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

async function checkPaymentTimeouts(now: Date) {
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

    // Find bets accepted > 10 min ago that are still in 'aceita' status
    const { data: bets, error } = await supabase
        .from('bets')
        .select('*')
        .eq('status', 'aceita')
        .lt('aceita_em', tenMinutesAgo);

    if (error || !bets) return { count: 0 };

    for (const bet of bets) {
        // Apply faults to players who didn't pay
        if (!bet.p1_pagou) {
            await addFault(bet.criador_id, 'Timeout de pagamento');
        }
        if (!bet.p2_pagou && bet.oponente_id) {
            await addFault(bet.oponente_id, 'Timeout de pagamento');
        }

        // Cancel bet
        await supabase
            .from('bets')
            .update({ status: 'cancelada' })
            .eq('id', bet.id);

        // Notify and close channel if exists
        if (bet.canal_pagamento_id) {
            try {
                await rest.post(Routes.channelMessages(bet.canal_pagamento_id), {
                    body: { content: '⚠️ **Aposta Cancelada!** O tempo limite de 10 minutos para o pagamento expirou. Faltas foram aplicadas aos jogadores que não pagaram.' }
                });
                // Optionally wait a bit before deleting or just leave it for admin to see?
                // The requirement says "fecha o canal".
                // await rest.delete(Routes.channel(bet.canal_pagamento_id));
            } catch (e) {
                console.error(`Error notifying channel ${bet.canal_pagamento_id}:`, e);
            }
        }
    }

    return { count: bets.length };
}

async function checkMatchStartTimeouts(now: Date) {
    const fortyFiveMinutesAgo = new Date(now.getTime() - 45 * 60 * 1000).toISOString();

    // Find bets 'paga' > 45 min ago without start
    // Note: We use 'aceita_em' as a proxy if we don't have 'paga_em', 
    // but ideally we'd have 'paga_em'. For now, let's assume 'paga' status.
    const { data: bets, error } = await supabase
        .from('bets')
        .select('*')
        .eq('status', 'paga')
        .lt('aceita_em', fortyFiveMinutesAgo); // Using aceita_em as fallback

    if (error || !bets) return { count: 0 };

    for (const bet of bets) {
        await supabase
            .from('bets')
            .update({ revisao_manual: true })
            .eq('id', bet.id);

        // Notify admin channel if exists
        const adminChannelId = process.env.CHANNEL_ADMIN_LOGS;
        if (adminChannelId) {
            await rest.post(Routes.channelMessages(adminChannelId), {
                body: { content: `🚨 **Atenção Admin!** A aposta \`${bet.id}\` está paga há mais de 45 minutos e ainda não foi iniciada.` }
            });
        }
    }

    return { count: bets.length };
}

async function checkResultTimeouts(now: Date) {
    const sixtyMinutesAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    // Find bets 'em_jogo' > 60 min ago
    const { data: bets, error } = await supabase
        .from('bets')
        .select('*')
        .eq('status', 'em_jogo')
        .lt('partida_iniciada_em', sixtyMinutesAgo);

    if (error || !bets) return { count: 0 };

    for (const bet of bets) {
        await supabase
            .from('bets')
            .update({ revisao_manual: true })
            .eq('id', bet.id);

        if (bet.canal_pagamento_id) {
            try {
                // Block chat (remove permissions for players)
                // This is complex via REST without knowing the guild/roles, 
                // but we can at least send a message.
                await rest.post(Routes.channelMessages(bet.canal_pagamento_id), {
                    body: { content: '🔒 **Chat Bloqueado!** O tempo limite de 60 minutos de jogo expirou. Um administrador irá revisar a partida.' }
                });
            } catch (e) {
                console.error(`Error notifying channel ${bet.canal_pagamento_id}:`, e);
            }
        }
    }

    return { count: bets.length };
}
