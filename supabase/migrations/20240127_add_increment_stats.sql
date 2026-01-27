-- Function to increment player stats atomically
CREATE OR REPLACE FUNCTION increment_stats(user_id TEXT, is_win BOOLEAN, amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE players
  SET
    partidas_jogadas = partidas_jogadas + 1,
    vitorias = vitorias + (CASE WHEN is_win THEN 1 ELSE 0 END),
    derrotas = derrotas + (CASE WHEN NOT is_win THEN 1 ELSE 0 END),
    total_ganho = total_ganho + (CASE WHEN is_win THEN amount ELSE 0 END),
    total_apostado = total_apostado + amount, -- Both players bet the amount
    saldo_lucro = (total_ganho + (CASE WHEN is_win THEN amount ELSE 0 END)) - (total_apostado + amount)
  WHERE discord_id = user_id;
END;
$$ LANGUAGE plpgsql;
