-- Add new fields for admin control and double confirmation
ALTER TABLE bets
ADD COLUMN IF NOT EXISTS modo_sala TEXT CHECK (modo_sala IN ('full_mobile', 'misto')),
ADD COLUMN IF NOT EXISTS jogador1_id TEXT REFERENCES players(discord_id),
ADD COLUMN IF NOT EXISTS jogador2_id TEXT REFERENCES players(discord_id),
ADD COLUMN IF NOT EXISTS jogador1_aceitou BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS jogador2_aceitou BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS criador_admin_id TEXT;

-- Update existing criador_id to criador_admin_id for old records
UPDATE bets SET criador_admin_id = criador_id WHERE criador_admin_id IS NULL;

-- Note: We keep criador_id and oponente_id for backward compatibility
-- New bets will use jogador1_id and jogador2_id
