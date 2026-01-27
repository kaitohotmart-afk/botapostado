DROP FUNCTION IF EXISTS increment_stats(text, boolean, numeric);

CREATE OR REPLACE FUNCTION increment_stats(user_id_param TEXT, is_win BOOLEAN, bet_amount NUMERIC, payout_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE players
  SET
    partidas_jogadas = partidas_jogadas + 1,
    vitorias = vitorias + (CASE WHEN is_win THEN 1 ELSE 0 END),
    derrotas = derrotas + (CASE WHEN NOT is_win THEN 1 ELSE 0 END),
    total_ganho = total_ganho + payout_amount,
    total_apostado = total_apostado + bet_amount,
    saldo_lucro = (total_ganho + payout_amount) - (total_apostado + bet_amount)
  WHERE discord_id = user_id_param;
END;
$$ LANGUAGE plpgsql;
