-- Player levels and stats
CREATE TABLE IF NOT EXISTS player_levels (
  discord_id TEXT PRIMARY KEY REFERENCES players(discord_id),
  level TEXT DEFAULT 'bronze' CHECK (level IN ('bronze', 'prata', 'ouro', 'diamante')),
  total_bets INT DEFAULT 0,
  total_wins INT DEFAULT 0,
  total_losses INT DEFAULT 0,
  total_profit INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Season rankings (weekly/monthly data)
CREATE TABLE IF NOT EXISTS season_rankings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  discord_id TEXT REFERENCES players(discord_id),
  season_type TEXT CHECK (season_type IN ('weekly', 'monthly')),
  season_id TEXT, -- e.g., '2024-W04' or '2024-01'
  wins INT DEFAULT 0,
  losses INT DEFAULT 0,
  total_bet INT DEFAULT 0,
  profit INT DEFAULT 0,
  win_rate DECIMAL(5,2) DEFAULT 0,
  UNIQUE(discord_id, season_type, season_id)
);

-- Season champions history
CREATE TABLE IF NOT EXISTS season_champions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_type TEXT CHECK (season_type IN ('weekly', 'monthly')),
  season_id TEXT,
  discord_id TEXT REFERENCES players(discord_id),
  wins INT,
  profit INT,
  announced_at TIMESTAMP DEFAULT NOW()
);

-- Level config (for future adjustments)
CREATE TABLE IF NOT EXISTS level_config (
  level TEXT PRIMARY KEY,
  required_bets INT,
  discord_role_name TEXT
);

INSERT INTO level_config (level, required_bets, discord_role_name) VALUES
  ('bronze', 0, 'Bronze'),
  ('prata', 30, 'Prata'),
  ('ouro', 50, 'Ouro'),
  ('diamante', 100, 'Diamante')
ON CONFLICT (level) DO NOTHING;
