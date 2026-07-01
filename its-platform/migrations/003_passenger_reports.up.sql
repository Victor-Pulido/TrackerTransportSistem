CREATE TABLE IF NOT EXISTS passenger_reports (
    id                TEXT PRIMARY KEY,
    operator_id       TEXT NOT NULL REFERENCES operators(id),
    route_id          TEXT NOT NULL REFERENCES routes(id),
    report_date       TEXT NOT NULL,
    total_passengers  INTEGER NOT NULL DEFAULT 0,
    notes             TEXT,
    submitted_by      TEXT REFERENCES users(id),
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(operator_id, route_id, report_date)
);

CREATE INDEX IF NOT EXISTS idx_pr_operator_date ON passenger_reports(operator_id, report_date);
CREATE INDEX IF NOT EXISTS idx_pr_route_date    ON passenger_reports(route_id, report_date);
