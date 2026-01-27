import { supabase } from './supabase.js';

/**
 * Adds a fault to a player and applies a block if necessary.
 * 
 * Rules:
 * 1 fault: Warning only.
 * 2 faults: 24h block.
 * 3 faults: 3-day block.
 * 4+ faults: Permanent block (set to a very far date).
 */
export async function addFault(discordId: string, reason: string) {
    // Get current faults
    const { data: player, error: fetchError } = await supabase
        .from('players')
        .select('faltas')
        .eq('discord_id', discordId)
        .single();

    if (fetchError || !player) {
        console.error(`Error fetching player ${discordId}:`, fetchError);
        return;
    }

    const newFaults = (player.faltas || 0) + 1;
    let bloqueadoAte: Date | null = null;

    if (newFaults === 2) {
        bloqueadoAte = new Date();
        bloqueadoAte.setHours(bloqueadoAte.getHours() + 24);
    } else if (newFaults === 3) {
        bloqueadoAte = new Date();
        bloqueadoAte.setDate(bloqueadoAte.getDate() + 3);
    } else if (newFaults >= 4) {
        // Permanent block (e.g., 100 years from now)
        bloqueadoAte = new Date();
        bloqueadoAte.setFullYear(bloqueadoAte.getFullYear() + 100);
    }

    const { error: updateError } = await supabase
        .from('players')
        .update({
            faltas: newFaults,
            bloqueado_ate: bloqueadoAte ? bloqueadoAte.toISOString() : null
        })
        .eq('discord_id', discordId);

    if (updateError) {
        console.error(`Error updating faults for player ${discordId}:`, updateError);
    }

    return { newFaults, bloqueadoAte };
}

/**
 * Checks if a player is currently blocked.
 */
export async function isPlayerBlocked(discordId: string): Promise<{ blocked: boolean; until?: string }> {
    const { data: player, error } = await supabase
        .from('players')
        .select('bloqueado_ate')
        .eq('discord_id', discordId)
        .single();

    if (error || !player || !player.bloqueado_ate) {
        return { blocked: false };
    }

    const bloqueadoAte = new Date(player.bloqueado_ate);
    const now = new Date();

    if (bloqueadoAte > now) {
        return { blocked: true, until: player.bloqueado_ate };
    }

    return { blocked: false };
}
