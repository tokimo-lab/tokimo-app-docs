-- Docs app schema tables
-- All tables use the "docs" schema

-- Doc spaces
CREATE TABLE IF NOT EXISTS docs_spaces (
    id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name        text        NOT NULL,
    avatar      jsonb,
    description text,
    vfs_id      uuid,
    root_path   text,
    sort_order  integer     NOT NULL DEFAULT 0,
    created_at  timestamptz DEFAULT NOW(),
    updated_at  timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS docs_spaces_sort_order_idx ON docs_spaces (sort_order, created_at);

-- Doc node metadata (composite primary key: space_id + rel_path)
CREATE TABLE IF NOT EXISTS docs_node_meta (
    space_id       uuid        NOT NULL,
    rel_path       text        NOT NULL,
    is_favorite    boolean     NOT NULL DEFAULT false,
    is_pinned      boolean     NOT NULL DEFAULT false,
    is_archived    boolean     NOT NULL DEFAULT false,
    icon           text,
    cover_image    text,
    tags           jsonb,
    last_opened_at timestamptz,
    sort_order     integer     NOT NULL DEFAULT 0,
    word_count     integer     NOT NULL DEFAULT 0,
    created_at     timestamptz NOT NULL DEFAULT NOW(),
    updated_at     timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (space_id, rel_path)
);

CREATE INDEX IF NOT EXISTS docs_node_meta_space_id_idx ON docs_node_meta (space_id);
CREATE INDEX IF NOT EXISTS docs_node_meta_is_favorite_idx ON docs_node_meta (space_id, is_favorite) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS docs_node_meta_is_archived_idx ON docs_node_meta (space_id, is_archived);

-- Doc node versions
CREATE TABLE IF NOT EXISTS docs_node_versions (
    id         uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    space_id   uuid        NOT NULL,
    rel_path   text        NOT NULL,
    version    integer     NOT NULL DEFAULT 1,
    title      text        NOT NULL,
    content    jsonb,
    word_count integer     NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS docs_node_versions_space_path_idx ON docs_node_versions (space_id, rel_path, version DESC);

-- Doc node comments
CREATE TABLE IF NOT EXISTS docs_node_comments (
    id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    space_id    uuid        NOT NULL,
    rel_path    text        NOT NULL,
    user_id     uuid        NOT NULL,
    comment_key text        NOT NULL,
    content     text        NOT NULL,
    is_resolved boolean     NOT NULL DEFAULT false,
    parent_id   uuid,
    created_at  timestamptz NOT NULL DEFAULT NOW(),
    updated_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS docs_node_comments_space_path_idx ON docs_node_comments (space_id, rel_path);

-- Doc node attachments
CREATE TABLE IF NOT EXISTS docs_node_attachments (
    id               uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    space_id         uuid        NOT NULL,
    rel_path         text        NOT NULL,
    storage_key      text        NOT NULL,
    file_name        text        NOT NULL,
    file_type        text        NOT NULL,
    file_size        integer     NOT NULL DEFAULT 0,
    is_binary        boolean,
    detected_mime    text,
    file_category    text,
    text_encoding    text,
    detected_language text,
    created_at       timestamptz NOT NULL DEFAULT NOW(),
    deleted_at       timestamptz
);

CREATE INDEX IF NOT EXISTS docs_node_attachments_space_path_idx ON docs_node_attachments (space_id, rel_path) WHERE deleted_at IS NULL;

-- Doc node view states (composite primary key: user_id + space_id + rel_path)
CREATE TABLE IF NOT EXISTS docs_node_view_states (
    id         uuid        NOT NULL DEFAULT gen_random_uuid(),
    user_id    uuid        NOT NULL,
    space_id   uuid        NOT NULL,
    rel_path   text        NOT NULL,
    view_state jsonb       NOT NULL DEFAULT '{}',
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, space_id, rel_path)
);

-- Doc base records (spreadsheet-like data)
CREATE TABLE IF NOT EXISTS docs_base_records (
    id         uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    space_id   uuid        NOT NULL,
    rel_path   text        NOT NULL,
    data       jsonb       NOT NULL DEFAULT '{}',
    sort_order integer     NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS docs_base_records_space_path_idx ON docs_base_records (space_id, rel_path, sort_order);

-- Whiteboard user libraries
CREATE TABLE IF NOT EXISTS docs_whiteboard_user_libraries (
    id         uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id    uuid        NOT NULL UNIQUE,
    items      jsonb       NOT NULL DEFAULT '[]',
    updated_at timestamptz NOT NULL DEFAULT NOW()
);
