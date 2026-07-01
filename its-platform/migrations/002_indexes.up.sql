CREATE INDEX IF NOT EXISTS idx_trips_operator        ON trips(operator_id);
CREATE INDEX IF NOT EXISTS idx_infractions_operator  ON infractions(operator_id);
CREATE INDEX IF NOT EXISTS idx_financial_operator_date ON financial_records(operator_id, record_date);
