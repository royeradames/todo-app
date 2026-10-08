CREATE TABLE todo_lists (
  owner_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0)
);
CREATE TABLE todo_items (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL REFERENCES todo_lists(owner_id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 500),
  completed boolean NOT NULL DEFAULT false,
  position integer NOT NULL CHECK (position >= 0),
  UNIQUE (owner_id, position) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX todo_items_owner ON todo_items(owner_id);
