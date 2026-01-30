-- Create queues table
CREATE TABLE IF NOT EXISTS queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT,
    game_mode TEXT NOT NULL, -- '1x1', '2x2', '3x3', '4x4'
    bet_value NUMERIC NOT NULL,
    required_players INT NOT NULL,
    current_players JSONB DEFAULT '[]'::jsonb,
    is_mobile_only BOOLEAN DEFAULT FALSE, -- To separate mobile queues if needed
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update bets table to support multi-player and queue tracking
ALTER TABLE bets
ADD COLUMN IF NOT EXISTS players_data JSONB DEFAULT '{}'::jsonb, -- Stores full list of players/teams: { teamA: [id1, id2], teamB: [id3, id4] }
ADD COLUMN IF NOT EXISTS queue_id UUID REFERENCES queues(id);

-- ensure players_data is not null for new rows (optional, but good practice if we default it)
