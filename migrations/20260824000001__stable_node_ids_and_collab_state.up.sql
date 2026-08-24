-- Give every VFS-backed node a stable identity that survives path changes.
ALTER TABLE docs_node_meta
    ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

UPDATE docs_node_meta
SET id = gen_random_uuid()
WHERE id IS NULL;

ALTER TABLE docs_node_meta
    ALTER COLUMN id SET NOT NULL,
    ALTER COLUMN id SET DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS docs_node_meta_id_idx
    ON docs_node_meta (id);

-- Yjs is the canonical collaborative state. The VFS JSON file remains a
-- portable projection used by exports, previews, and non-collab editors.
CREATE TABLE IF NOT EXISTS docs_collab_states (
    node_id    uuid        NOT NULL PRIMARY KEY,
    yjs_state bytea       NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT docs_collab_states_node_id_fkey
        FOREIGN KEY (node_id) REFERENCES docs_node_meta (id) ON DELETE CASCADE
);
