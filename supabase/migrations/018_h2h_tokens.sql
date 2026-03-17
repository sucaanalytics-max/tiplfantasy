-- H2H Token Mode: 1v1 challenges with wagered tokens

-- User token balances
CREATE TABLE user_tokens (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Token transaction audit log
CREATE TABLE token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('admin_grant', 'h2h_wager', 'h2h_win', 'h2h_refund')),
  reference_id UUID,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_token_txns_user ON token_transactions(user_id);

-- H2H challenges
CREATE TABLE h2h_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id),
  challenger_id UUID NOT NULL REFERENCES profiles(id),
  opponent_id UUID REFERENCES profiles(id),
  wager INTEGER NOT NULL CHECK (wager > 0),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'accepted', 'completed', 'cancelled', 'expired')),
  winner_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_h2h_match ON h2h_challenges(match_id);
CREATE INDEX idx_h2h_challenger ON h2h_challenges(challenger_id);
CREATE INDEX idx_h2h_opponent ON h2h_challenges(opponent_id);

-- RLS policies
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE h2h_challenges ENABLE ROW LEVEL SECURITY;

-- user_tokens: users can read own balance
CREATE POLICY "Users can view own token balance"
  ON user_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- token_transactions: users can read own transactions
CREATE POLICY "Users can view own transactions"
  ON token_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- h2h_challenges: all authenticated users can read all challenges
CREATE POLICY "Anyone can view challenges"
  ON h2h_challenges FOR SELECT
  TO authenticated
  USING (true);

-- h2h_challenges: users can insert as challenger
CREATE POLICY "Users can create challenges"
  ON h2h_challenges FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = challenger_id);
