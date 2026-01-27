import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../src/utils/supabase.js';
import { rest } from '../src/utils/discord.js';
import { Routes } from 'discord.js';
import { getWeek, subWeeks, subMonths, format } from 'date-fns';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Basic security check (Vercel Cron)
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
        return res.status(401).end('Unauthorized');
    }

    try {
        const results = {
            weekly: await processSeason('weekly'),
            monthly: await processSeason('monthly')
        };

        return res.status(200).json(results);
    } catch (error) {
        console.error('Cron error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

async function processSeason(type: 'weekly' | 'monthly') {
    const now = new Date();
    let seasonId = '';
    let seasonName = '';

    if (type === 'weekly') {
        // Get PREVIOUS week
        const lastWeek = subWeeks(now, 1);
        const weekNumber = getWeek(lastWeek, { weekStartsOn: 1 });
        const year = lastWeek.getFullYear();
        seasonId = `${year}-W${weekNumber.toString().padStart(2, '0')}`;
        seasonName = `Semana ${weekNumber}/${year}`;
    } else {
        // Get PREVIOUS month
        const lastMonth = subMonths(now, 1);
        const month = (lastMonth.getMonth() + 1).toString().padStart(2, '0');
        const year = lastMonth.getFullYear();
        seasonId = `${year}-${month}`;
        seasonName = `Mês ${month}/${year}`;
    }

    // 1. Check if already announced
    const { data: existing } = await supabase
        .from('season_champions')
        .select('*')
        .eq('season_type', type)
        .eq('season_id', seasonId)
        .single();

    if (existing) {
        return { status: 'already_announced', seasonId };
    }

    // 2. Find Winner
    const { data: rankings } = await supabase
        .from('season_rankings')
        .select('*')
        .eq('season_type', type)
        .eq('season_id', seasonId)
        .order('wins', { ascending: false }) // Primary: Wins
        .order('profit', { ascending: false }) // Secondary: Profit
        .limit(1);

    if (!rankings || rankings.length === 0) {
        return { status: 'no_data', seasonId };
    }

    const winner = rankings[0];

    // 3. Announce in Discord
    const channelId = process.env.CHANNEL_ANNOUNCEMENTS;
    if (channelId) {
        try {
            const profitText = new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(winner.profit);

            await rest.post(Routes.channelMessages(channelId), {
                body: {
                    content: `🏆 **FIM DA TEMPORADA!** 🏆\n\nO campeão do **${type === 'weekly' ? 'Ranking Semanal' : 'Ranking Mensal'}** (${seasonName}) é <@${winner.discord_id}>! 🎉`,
                    embeds: [
                        {
                            title: `👑 CAMPEÃO ${type === 'weekly' ? 'DA SEMANA' : 'DO MÊS'}`,
                            description: `Parabéns <@${winner.discord_id}> pelo desempenho incrível!`,
                            color: 0xFFD700,
                            fields: [
                                { name: '⚔️ Vitórias', value: `${winner.wins}`, inline: true },
                                { name: '💰 Lucro', value: `${profitText}`, inline: true },
                                { name: '📈 Taxa de Vitória', value: `${winner.win_rate}%`, inline: true }
                            ],
                            thumbnail: { url: 'https://i.imgur.com/5w5y5x5.png' } // Generic trophy image
                        }
                    ]
                }
            });
        } catch (discordError) {
            console.error('Error sending announcement:', discordError);
            // Don't return here, still try to save to DB so we don't spam if Discord fails? 
            // Or maybe we SHOULD return so we retry later?
            // Let's return error so we retry.
            throw discordError;
        }
    } else {
        console.warn('CHANNEL_ANNOUNCEMENTS not set');
    }

    // 4. Save to History
    await supabase.from('season_champions').insert({
        season_type: type,
        season_id: seasonId,
        discord_id: winner.discord_id,
        wins: winner.wins,
        profit: winner.profit
    });

    return { status: 'announced', seasonId, winner: winner.discord_id };
}
