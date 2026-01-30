import { rest } from './discord.js';
import { Routes } from 'discord.js';

/**
 * Sends a Direct Message to a user.
 */
export async function sendDM(userId: string, content: string | object) {
    try {
        // 1. Create DM channel
        const channel: any = await rest.post(Routes.userChannels(), {
            body: { recipient_id: userId }
        });

        // 2. Send message
        await rest.post(Routes.channelMessages(channel.id), {
            body: typeof content === 'string' ? { content } : content
        });

        return true;
    } catch (error) {
        console.error(`Failed to send DM to ${userId}:`, error);
        return false;
    }
}

/**
 * Generates a text-based progress bar.
 */
export function generateProgressBar(current: number, total: number, size = 10) {
    const progress = Math.min(Math.max(current / total, 0), 1);
    const filledSize = Math.floor(progress * size);
    const emptySize = size - filledSize;

    const filledBar = '🟩'.repeat(filledSize);
    const emptyBar = '⬜'.repeat(emptySize);

    const percentage = Math.floor(progress * 100);
    return `${filledBar}${emptyBar} **${percentage}%**`;
}

/**
 * Calculates current progress towards the next level.
 */
import { LEVELS } from './levels.js';

export function getLevelProgress(totalBets: number) {
    const levelsArr = Object.values(LEVELS).sort((a, b) => a.minBets - b.minBets);

    let currentLevel = levelsArr[0];
    let nextLevel = null;

    for (let i = 0; i < levelsArr.length; i++) {
        if (totalBets >= levelsArr[i].minBets) {
            currentLevel = levelsArr[i];
            nextLevel = levelsArr[i + 1] || null;
        } else {
            break;
        }
    }

    if (!nextLevel) {
        return {
            currentLevel: currentLevel.name,
            nextLevel: 'MAX',
            current: totalBets,
            total: totalBets,
            percentage: 100,
            bar: generateProgressBar(1, 1)
        };
    }

    const progressInLevel = totalBets - currentLevel.minBets;
    const requiredForNext = nextLevel.minBets - currentLevel.minBets;

    return {
        currentLevel: currentLevel.name,
        nextLevel: nextLevel.name,
        current: totalBets,
        total: nextLevel.minBets,
        progressInLevel,
        requiredForNext,
        percentage: Math.floor((progressInLevel / requiredForNext) * 100),
        bar: generateProgressBar(progressInLevel, requiredForNext)
    };
}

/**
 * Checks for player achievements/badges.
 */
export function getPlayerBadges(stats: any) {
    const badges = [];

    if (stats.total_wins >= 1) badges.push('🎯 **Primeiro Sangue**');
    if (stats.total_bets >= 10) badges.push('🛡️ **Iniciante**');
    if (stats.total_wins >= 50) badges.push('⚔️ **Guerreiro Veterano**');
    if (stats.total_profit >= 1000) badges.push('💰 **Investidor**');
    if (stats.total_wins >= 100) badges.push('🏆 **Lenda do Servidor**');

    return badges.length > 0 ? badges.join(' | ') : 'Nenhuma conquista ainda.';
}
