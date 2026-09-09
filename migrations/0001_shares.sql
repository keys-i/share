CREATE TABLE shares (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  repository_id INTEGER NOT NULL,
  installation_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX shares_expiry ON shares(expires_at);

CREATE TABLE authorizations (
  state TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX authorizations_expiry ON authorizations(expires_at);
