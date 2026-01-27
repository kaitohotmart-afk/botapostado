-- Create players table
CREATE TABLE players (
    discord_id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    vitorias INTEGER DEFAULT 0,
    derrotas INTEGER DEFAULT 0,
    partidas_jogadas INTEGER DEFAULT 0,
    total_apostado NUMERIC DEFAULT 0,
    total_ganho NUMERIC DEFAULT 0,
    saldo_lucro NUMERIC DEFAULT 0,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bets table
CREATE TABLE bets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    criador_id TEXT REFERENCES players(discord_id),
    oponente_id TEXT REFERENCES players(discord_id),
    modo TEXT NOT NULL,
    valor NUMERIC NOT NULL,
    status TEXT CHECK (status IN ('aguardando', 'aceita', 'paga', 'em_jogo', 'finalizada', 'cancelada')) DEFAULT 'aguardando',
    vencedor_id TEXT REFERENCES players(discord_id),
    canal_pagamento_id TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    finalizado_em TIMESTAMP WITH TIME ZONE
);
