import { getWeek, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';

export function getCurrentSeasonIDs() {
    const now = new Date();

    // Weekly Season ID: "2024-W05"
    const weekNumber = getWeek(now, { weekStartsOn: 1 }); // ISO week starts on Monday
    const year = now.getFullYear();
    const weeklySeasonId = `${year}-W${weekNumber.toString().padStart(2, '0')}`;

    // Monthly Season ID: "2024-01"
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const monthlySeasonId = `${year}-${month}`;

    return { weeklySeasonId, monthlySeasonId };
}

export function getSeasonBoundaries() {
    const now = new Date();

    return {
        weekStart: startOfWeek(now, { weekStartsOn: 1 }),
        weekEnd: endOfWeek(now, { weekStartsOn: 1 }),
        monthStart: startOfMonth(now),
        monthEnd: endOfMonth(now)
    };
}

export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(amount);
}
