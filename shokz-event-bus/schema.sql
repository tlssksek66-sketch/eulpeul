CREATE TABLE IF NOT EXISTS events (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  ts      TEXT NOT NULL,
  ts_kst  TEXT NOT NULL,
  source  TEXT NOT NULL,
  kind    TEXT NOT NULL,
  status  TEXT NOT NULL,
  summary TEXT,
  payload TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_ts             ON events(ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_source_status  ON events(source, status);
CREATE INDEX IF NOT EXISTS idx_events_kind           ON events(kind);
