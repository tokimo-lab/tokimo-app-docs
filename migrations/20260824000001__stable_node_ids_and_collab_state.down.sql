DROP TABLE IF EXISTS docs_collab_states;
DROP INDEX IF EXISTS docs_node_meta_id_idx;
ALTER TABLE docs_node_meta DROP COLUMN IF EXISTS id;
