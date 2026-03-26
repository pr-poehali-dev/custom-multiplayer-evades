
CREATE TABLE IF NOT EXISTS rooms (
  code       TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level      INT NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '2 hours'
);

CREATE TABLE IF NOT EXISTS room_players (
  room_code   TEXT NOT NULL REFERENCES rooms(code),
  player_id   TEXT NOT NULL,
  char_id     TEXT NOT NULL,
  char_name   TEXT NOT NULL,
  char_color  TEXT NOT NULL,
  px          FLOAT NOT NULL DEFAULT 80,
  py          FLOAT NOT NULL DEFAULT 110,
  dead        BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_code, player_id)
);
