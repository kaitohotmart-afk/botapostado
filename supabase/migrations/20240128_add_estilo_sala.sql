-- Add estilo_sala column to bets table
ALTER TABLE bets
ADD COLUMN IF NOT EXISTS estilo_sala TEXT CHECK (estilo_sala IN ('normal', 'tatico')) DEFAULT 'normal';
