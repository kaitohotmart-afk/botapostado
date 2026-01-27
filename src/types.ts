export interface Player {
    discord_id: string;
    nome: string;
    vitorias: number;
    derrotas: number;
    partidas_jogadas: number;
    total_apostado: number;
    total_ganho: number;
    saldo_lucro: number;
    criado_em: string;
}

export interface Bet {
    id: string;
    criador_id: string;
    oponente_id?: string;
    modo: string;
    valor: number;
    status: 'aguardando' | 'aceita' | 'paga' | 'em_jogo' | 'finalizada' | 'cancelada';
    vencedor_id?: string;
    canal_pagamento_id?: string;
    criado_em: string;
    finalizado_em?: string;
}
