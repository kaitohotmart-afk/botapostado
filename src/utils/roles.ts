import { rest } from './discord.js';
import { Routes } from 'discord.js';

const CREATOR_ROLE_NAME = 'Criador de Apostas';

async function getRoleIdByName(guildId: string, roleName: string): Promise<string | null> {
    try {
        const roles = await rest.get(Routes.guildRoles(guildId)) as any[];
        const role = roles.find((r: any) => r.name === roleName);
        return role ? role.id : null;
    } catch (error) {
        console.error(`Error fetching roles for guild ${guildId}:`, error);
        return null;
    }
}

export async function addCreatorRole(guildId: string, userId: string) {
    const roleId = await getRoleIdByName(guildId, CREATOR_ROLE_NAME);
    if (!roleId) {
        console.warn(`Role "${CREATOR_ROLE_NAME}" not found in guild ${guildId}`);
        return;
    }

    try {
        await rest.put(Routes.guildMemberRole(guildId, userId, roleId));
    } catch (error) {
        console.error(`Error adding role to user ${userId}:`, error);
    }
}

export async function removeCreatorRole(guildId: string, userId: string) {
    const roleId = await getRoleIdByName(guildId, CREATOR_ROLE_NAME);
    if (!roleId) {
        console.warn(`Role "${CREATOR_ROLE_NAME}" not found in guild ${guildId}`);
        return;
    }

    try {
        await rest.delete(Routes.guildMemberRole(guildId, userId, roleId));
    } catch (error) {
        console.error(`Error removing role from user ${userId}:`, error);
    }
}

export async function hasCreatorRole(guildId: string, member: any): Promise<boolean> {
    const memberRoles = member.roles || [];
    const roleId = await getRoleIdByName(guildId, CREATOR_ROLE_NAME);
    if (!roleId) return false;
    return memberRoles.includes(roleId);
}
