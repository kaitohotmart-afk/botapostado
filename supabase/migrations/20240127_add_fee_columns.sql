ALTER TABLE bets
ADD COLUMN IF NOT EXISTS taxa NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS valor_pago NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tipo_finalizacao TEXT CHECK (tipo_finalizacao IN ('normal', 'wo_irregularidade'));
