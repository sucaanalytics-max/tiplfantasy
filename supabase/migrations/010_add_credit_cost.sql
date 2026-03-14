-- Add credit_cost column to players (already exists in live DB, this tracks the schema)
ALTER TABLE players ADD COLUMN IF NOT EXISTS credit_cost NUMERIC(3,1) NOT NULL DEFAULT 7.0;
