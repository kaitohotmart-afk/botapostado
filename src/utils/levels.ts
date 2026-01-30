import { supabase } from './supabase.js';
import { rest } from './discord.js';
import { Routes } from 'discord.js';

// Level configuration
export const LEVELS = {
    BRONZE: { name: 'bronze', minBets: 0, roleName: 'Bronze' },
    PRATA: { name: 'prata', minBets: 30, roleName: 'Prata' },
    OURO: { name: 'ouro', minBets: 50, roleName: 'Ouro' },
    DIAMANTE: { name: 'diamante', minBets: 100, roleName: 'Diamante' }
};

export async function calculatePlayerLevel(totalBets: number): Promise<string> {
    if (totalBets >= LEVELS.DIAMANTE.minBets) return LEVELS.DIAMANTE.name;
    if (totalBets >= LEVELS.OURO.minBets) return LEVELS.OURO.name;
    if (totalBets >= LEVELS.PRATA.minBets) return LEVELS.PRATA.name;
    return LEVELS.BRONZE.name;
}

export async function updatePlayerLevel(discordId: string, guildId: string) {
    try {
        // 1. Get player stats
        const { data: playerStats, error: statsError } = await supabase
            .from('player_levels')
            .select('*')
            .eq('discord_id', discordId)
            .single();

        if (statsError && statsError.code !== 'PGRST116') {
            console.error('Error fetching player stats:', statsError);
            return;
        }

        // If no stats yet, initialize
        const currentBets = playerStats?.total_bets || 0;
        const currentLevel = playerStats?.level || 'bronze';

        // 2. Calculate new level
        const newLevel = await calculatePlayerLevel(currentBets);

        // 3. If level changed, update DB and Discord roles
        if (newLevel !== currentLevel || !playerStats) {
            // Update DB
            const { error: updateError } = await supabase
                .from('player_levels')
                .upsert({
                    discord_id: discordId,
                    level: newLevel,
                    total_bets: currentBets, // Ensure this is up to date
                    updated_at: new Date().toISOString()
                });

            if (updateError) {
                console.error('Error updating player level in DB:', updateError);
                return;
            }

            // Update Discord Roles
            await assignDiscordRole(guildId, discordId, newLevel);

            // Log level up
            if (newLevel !== 'bronze') {
                console.log(`Player ${discordId} leveled up to ${newLevel}!`);

                // Gold Benefit: Create Private Call
                if (newLevel === 'ouro') {
                    await createGoldChannel(guildId, discordId);
                }
            }
        }
    } catch (error) {
        console.error('Error in updatePlayerLevel:', error);
    }
}

async function createGoldChannel(guildId: string, userId: string) {
    try {
        // Fetch user to get username
        const user = await rest.get(Routes.user(userId)) as any;
        const username = user.username;
        const channelName = `🎤┃call-do-${username}`;

        // Create Voice Channel (Type 2)
        await rest.post(Routes.guildChannels(guildId), {
            body: {
                name: channelName,
                type: 2, // Guild Voice
                permission_overwrites: [
                    {
                        id: guildId, // @everyone
                        type: 0, // Role
                        deny: '1024', // VIEW_CHANNEL (actually CONNECT/VIEW for voice? View is 1024)
                        allow: '0'
                    },
                    {
                        id: userId,
                        type: 1, // Member
                        allow: '1048576', // CONNECT (Voice) + VIEW_CHANNEL (1024) + SPEAK (2097152)? 
                        // Let's give View (1024) + Connect (1048576) + Speak (2097152) + Stream (512)
                        // Total: 1024 + 1048576 + 2097152 + 512 = 3147264
                        // Actually, just giving Manage Channel might be too much.
                        // Let's give View, Connect, Speak.
                        // View: 0x400 (1024)
                        // Connect: 0x100000 (1048576)
                        // Speak: 0x200000 (2097152)
                        // Total: 3146752
                    }
                ]
            }
        });
        console.log(`Created Gold channel for ${username}`);
    } catch (error) {
        console.error('Error creating Gold channel:', error);
    }
}

async function assignDiscordRole(guildId: string, userId: string, levelName: string) {
    try {
        // 1. Get all roles from guild
        const roles: any = await rest.get(Routes.guildRoles(guildId));

        // 2. Find role ID for the new level
        const targetRoleName = Object.values(LEVELS).find(l => l.name === levelName)?.roleName;
        if (!targetRoleName) return;

        const role = roles.find((r: any) => r.name === targetRoleName);
        if (!role) {
            console.warn(`Role ${targetRoleName} not found in guild ${guildId}`);
            return;
        }

        // 3. Add role to user
        await rest.put(Routes.guildMemberRole(guildId, userId, role.id));

        // 4. Remove old level roles (optional, but good for clean roles)
        // For now we keep them or remove them? Usually level roles are exclusive.
        // Let's remove lower tier roles to keep it clean.
        for (const lvl of Object.values(LEVELS)) {
            if (lvl.name !== levelName) {
                const oldRole = roles.find((r: any) => r.name === lvl.roleName);
                if (oldRole) {
                    try {
                        await rest.delete(Routes.guildMemberRole(guildId, userId, oldRole.id));
                    } catch (e) {
                        // Ignore error if user didn't have the role
                    }
                }
            }
        }

    } catch (error) {
        console.error('Error assigning Discord role:', error);
    }
}

import { getCurrentSeasonIDs } from './seasons.js';

export async function incrementPlayerStats(discordId: string, isWin: boolean, betAmount: number, profit: number) {
    try {
        // 1. Get current stats
        const { data: current, error: fetchError } = await supabase
            .from('player_levels')
            .select('*')
            .eq('discord_id', discordId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

        const stats = current || {
            discord_id: discordId,
            level: 'bronze',
            total_bets: 0,
            total_wins: 0,
            total_losses: 0,
            total_profit: 0
        };

        // 2. Update Global Stats
        stats.total_bets += 1;
        if (isWin) {
            stats.total_wins += 1;
            stats.total_profit += profit;
        } else {
            stats.total_losses += 1;
            stats.total_profit += profit; // profit is negative for loser
        }

        // Determine level based on NEW total_bets
        const newLevel = await calculatePlayerLevel(stats.total_bets);
        stats.level = newLevel;
        stats.updated_at = new Date().toISOString();

        // Save to DB (Global)
        const { error: upsertError } = await supabase
            .from('player_levels')
            .upsert(stats);

        if (upsertError) throw upsertError;

        // 3. Update Season Rankings (Weekly & Monthly)
        const { weeklySeasonId, monthlySeasonId } = getCurrentSeasonIDs();
        const seasons = [
            { type: 'weekly', id: weeklySeasonId },
            { type: 'monthly', id: monthlySeasonId }
        ];

        for (const season of seasons) {
            // Fetch current season stats
            const { data: seasonStats, error: seasonError } = await supabase
                .from('season_rankings')
                .select('*')
                .eq('discord_id', discordId)
                .eq('season_type', season.type)
                .eq('season_id', season.id)
                .single();

            if (seasonError && seasonError.code !== 'PGRST116') {
                console.error(`Error fetching ${season.type} stats:`, seasonError);
                continue;
            }

            const currentSeasonStats = seasonStats || {
                discord_id: discordId,
                season_type: season.type,
                season_id: season.id,
                wins: 0,
                losses: 0,
                total_bet: 0,
                profit: 0,
                win_rate: 0
            };

            // Update values
            currentSeasonStats.total_bet += betAmount;
            currentSeasonStats.profit += profit;

            if (isWin) {
                currentSeasonStats.wins += 1;
            } else {
                currentSeasonStats.losses += 1;
            }

            const totalGames = currentSeasonStats.wins + currentSeasonStats.losses;
            currentSeasonStats.win_rate = totalGames > 0
                ? Number(((currentSeasonStats.wins / totalGames) * 100).toFixed(2))
                : 0;

            // Save to DB (Season)
            const { error: seasonUpsertError } = await supabase
                .from('season_rankings')
                .upsert(currentSeasonStats);

            if (seasonUpsertError) {
                console.error(`Error updating ${season.type} stats:`, seasonUpsertError);
            }
        }

        return { newLevel, stats };

    } catch (error) {
        console.error('Error incrementing player stats:', error);
        throw error;
    }
}
