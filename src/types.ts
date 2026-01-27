export interface Player {
    discord_id: string;
    nome: string;
    vitorias: number;
    derrotas: number;
    partidas_jogadas: number;
    total_apostado: number;
    total_ganho: number;
    saldo_lucro: number;
    faltas: number;
    bloqueado_ate?: string;
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
    aceita_em?: string;
    partida_iniciada_em?: string;
    p1_pagou: boolean;
    p2_pagou: boolean;
    revisao_manual: boolean;
    criado_em: string;
    finalizado_em?: string;
}
