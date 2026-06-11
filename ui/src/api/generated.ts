/**
 * Generated API client for the docs app — self-contained (no monolith imports).
 *
 * Provides React Query hooks for docs, vfs, and attachment endpoints.
 */

import {
  callApi,
  createPathMutation,
  createQuery,
  createMutation,
} from "../lib/rust-api-runtime";

// ── Types ────────────────────────────────────────────────────────────────────

export type DocsTab = "all" | "favorites" | "archived";

export interface DocSpaceOutput {
  id: string;
  name: string;
  avatar?: unknown;
  description?: string;
  vfsId?: string;
  rootPath?: string;
  sourceName?: string;
  sourceType?: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DocNodeListItem {
  relPath: string;
  spaceId: string;
  parentId?: string;
  type: string;
  title: string;
  icon?: string;
  tags?: string[];
  isFavorite: boolean;
  isPinned: boolean;
  isArchived: boolean;
  wordCount: number;
  sortOrder: number;
  lastOpenedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocNodeVersionOutput {
  id: string;
  spaceId: string;
  relPath: string;
  version: number;
  title: string;
  wordCount: number;
  createdAt: string;
}

export interface DocNodeVersionDetailOutput extends DocNodeVersionOutput {
  content?: unknown;
}

export interface DocNodeCommentOutput {
  id: string;
  spaceId: string;
  relPath: string;
  userId: string;
  userName: string;
  commentKey: string;
  content: string;
  isResolved: boolean;
  parentId?: string;
  replies: DocNodeCommentOutput[];
  createdAt: string;
  updatedAt: string;
}

export interface DocNodeAttachmentOutput {
  id: string;
  spaceId: string;
  relPath: string;
  storageKey: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  isBinary?: boolean;
  detectedMime?: string;
  fileCategory?: string;
  textEncoding?: string;
  detectedLanguage?: string;
  createdAt: string;
}

export interface BaseMetaOutput {
  relPath: string;
  fields: unknown;
  views: unknown;
  activeViewId?: string;
}

export interface BaseRecordOutput {
  id: string;
  spaceId: string;
  relPath: string;
  data: unknown;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface BatchDeleteOutput {
  deleted: number;
}

export interface LibraryAuthor {
  name: string;
  url?: string;
}

export interface LibraryCatalogItem {
  id: string;
  name: string;
  description: string;
  authors: LibraryAuthor[];
  previewUrl: string;
  itemCount?: number;
  itemNames?: string[];
  created: string;
  updated: string;
}

export interface VfsDto {
  id: string;
  name: string;
  type: string;
  config?: unknown;
  displayHints?: unknown;
  sortOrder: number;
  lastScanAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ── Input types ──────────────────────────────────────────────────────────────

interface RelPathInput {
  spaceId: string;
  relPath?: string;
  id?: string;
  nodeId?: string;
}

function encode(value: string): string {
  return encodeURIComponent(value);
}

function relPath(input: RelPathInput): string {
  return input.relPath ?? input.nodeId ?? input.id ?? "";
}

function appendRel(path: string, input: RelPathInput): string {
  return `${path}?relPath=${encode(relPath(input))}`;
}

// ── Docs API ─────────────────────────────────────────────────────────────────

const docsApi = {
  listSpaces: createQuery<Record<string, never>, DocSpaceOutput[]>({
    path: "/api/apps/docs/spaces",
    pathFn: () => "/api/apps/docs/spaces",
  }),

  createSpace: createPathMutation<
    {
      name: string;
      avatar?: Record<string, unknown> | null;
      description?: string | null;
      vfsId?: string | null;
      rootPath?: string | null;
    },
    DocSpaceOutput
  >({
    method: "POST",
    pathFn: () => "/api/apps/docs/spaces",
    bodyFn: (input) => input,
  }),

  updateSpace: createPathMutation<
    {
      id: string;
      name?: string;
      avatar?: Record<string, unknown> | null;
      description?: string | null;
      vfsId?: string | null;
      rootPath?: string | null;
      sortOrder?: number;
    },
    DocSpaceOutput
  >({
    method: "PATCH",
    pathFn: (input) => `/api/apps/docs/spaces/${encode(input.id)}`,
    bodyFn: (input) => {
      const { id: _, ...body } = input;
      return body;
    },
  }),

  deleteSpace: createPathMutation<{ id: string }, void>({
    method: "DELETE",
    pathFn: (input) => `/api/apps/docs/spaces/${encode(input.id)}`,
  }),

  list: createQuery<
    {
      spaceId: string;
      path?: string;
      tab?: DocsTab;
      page?: number;
      pageSize?: number;
      search?: string;
      tags?: string;
    },
    PageResult<DocNodeListItem>
  >({
    path: "/api/apps/docs/spaces/{spaceId}/nodes",
    pathFn: (input) => `/api/apps/docs/spaces/${encode(input.spaceId)}/nodes`,
    paramsFn: (input) => {
      const params: Record<string, string> = {};
      if (input.path != null) params.path = input.path;
      if (input.tab != null) params.tab = input.tab;
      if (input.page != null) params.page = String(input.page);
      if (input.pageSize != null) params.pageSize = String(input.pageSize);
      if (input.search) params.search = input.search;
      if (input.tags) params.tags = input.tags;
      return params;
    },
  }),

  listTags: createQuery<{ spaceId: string }, string[]>({
    path: "/api/apps/docs/spaces/{spaceId}/nodes/tags",
    pathFn: (input) =>
      `/api/apps/docs/spaces/${encode(input.spaceId)}/nodes/tags`,
  }),

  create: createPathMutation<
    {
      spaceId: string;
      parentRelPath?: string | null;
      type: string;
      title: string;
      content?: unknown;
    },
    DocNodeListItem
  >({
    method: "POST",
    pathFn: (input) => `/api/apps/docs/spaces/${encode(input.spaceId)}/nodes`,
    bodyFn: (input) => {
      const { spaceId: _, ...body } = input;
      return body;
    },
  }),

  getNode: createQuery<RelPathInput, unknown>({
    path: "/api/apps/docs/spaces/{spaceId}/node",
    pathFn: (input) => `/api/apps/docs/spaces/${encode(input.spaceId)}/node`,
    paramsFn: (input) => ({ relPath: relPath(input) }),
  }),

  getById: createQuery<RelPathInput, unknown>({
    path: "/api/apps/docs/spaces/{spaceId}/node",
    pathFn: (input) => `/api/apps/docs/spaces/${encode(input.spaceId)}/node`,
    paramsFn: (input) => ({ relPath: relPath(input) }),
  }),

  updateNode: createPathMutation<
    RelPathInput & {
      content?: unknown;
      title?: string;
      tags?: string[];
      icon?: string | null;
      coverImage?: string | null;
    },
    DocNodeListItem
  >({
    method: "PATCH",
    pathFn: (input) =>
      appendRel(`/api/apps/docs/spaces/${encode(input.spaceId)}/node`, input),
    bodyFn: (input) => {
      const { spaceId: _, relPath: __, id: ___, nodeId: ____, ...body } =
        input;
      return body;
    },
  }),

  update: createPathMutation<
    RelPathInput & {
      content?: unknown;
      title?: string;
      tags?: string[];
      icon?: string | null;
      coverImage?: string | null;
    },
    DocNodeListItem
  >({
    method: "PATCH",
    pathFn: (input) =>
      appendRel(`/api/apps/docs/spaces/${encode(input.spaceId)}/node`, input),
    bodyFn: (input) => {
      const { spaceId: _, relPath: __, id: ___, nodeId: ____, ...body } =
        input;
      return body;
    },
  }),

  archive: createPathMutation<RelPathInput, void>({
    method: "DELETE",
    pathFn: (input) =>
      appendRel(`/api/apps/docs/spaces/${encode(input.spaceId)}/node`, input),
  }),

  restore: createPathMutation<RelPathInput, void>({
    method: "PATCH",
    pathFn: (input) =>
      appendRel(
        `/api/apps/docs/spaces/${encode(input.spaceId)}/node/restore`,
        input,
      ),
  }),

  permanentDelete: createPathMutation<RelPathInput, void>({
    method: "DELETE",
    pathFn: (input) =>
      appendRel(
        `/api/apps/docs/spaces/${encode(input.spaceId)}/node/permanent`,
        input,
      ),
  }),

  toggleFavorite: createPathMutation<RelPathInput, { isFavorite: boolean }>({
    method: "PATCH",
    pathFn: (input) =>
      appendRel(
        `/api/apps/docs/spaces/${encode(input.spaceId)}/node/favorite`,
        input,
      ),
  }),

  togglePin: createPathMutation<RelPathInput, { isPinned: boolean }>({
    method: "PATCH",
    pathFn: (input) =>
      appendRel(
        `/api/apps/docs/spaces/${encode(input.spaceId)}/node/pin`,
        input,
      ),
  }),

  move: createPathMutation<
    {
      spaceId: string;
      from?: string;
      to?: string;
      relPath?: string;
      id?: string;
      newParentPath?: string | null;
      sortOrder?: number;
    },
    void
  >({
    method: "PATCH",
    pathFn: (input) => {
      const from = input.from ?? input.relPath ?? input.id ?? "";
      const to = input.to ?? input.newParentPath ?? "";
      return `/api/apps/docs/spaces/${encode(input.spaceId)}/node/move?from=${encode(from)}&to=${encode(to)}`;
    },
  }),

  listComments: createQuery<RelPathInput, DocNodeCommentOutput[]>({
    path: "/api/apps/docs/spaces/{spaceId}/node/comments",
    pathFn: (input) =>
      `/api/apps/docs/spaces/${encode(input.spaceId)}/node/comments`,
    paramsFn: (input) => ({ relPath: relPath(input) }),
  }),

  createComment: createPathMutation<
    RelPathInput & {
      commentKey: string;
      content: string;
      parentId?: string | null;
    },
    { id: string; commentKey: string; createdAt: string }
  >({
    method: "POST",
    pathFn: (input) =>
      appendRel(
        `/api/apps/docs/spaces/${encode(input.spaceId)}/node/comments`,
        input,
      ),
    bodyFn: (input) => ({
      commentKey: input.commentKey,
      content: input.content,
      parentId: input.parentId,
    }),
  }),

  resolveComment: createPathMutation<
    { spaceId: string; commentId?: string; id?: string; resolved: boolean },
    void
  >({
    method: "PATCH",
    pathFn: (input) =>
      `/api/apps/docs/spaces/${encode(input.spaceId)}/node/comment/${encode(input.commentId ?? input.id ?? "")}/resolve`,
    bodyFn: (input) => ({ resolved: input.resolved }),
  }),

  deleteComment: createPathMutation<
    { spaceId: string; commentId?: string; id?: string },
    void
  >({
    method: "DELETE",
    pathFn: (input) =>
      `/api/apps/docs/spaces/${encode(input.spaceId)}/node/comment/${encode(input.commentId ?? input.id ?? "")}`,
  }),

  listVersions: createQuery<RelPathInput, DocNodeVersionOutput[]>({
    path: "/api/apps/docs/spaces/{spaceId}/node/versions",
    pathFn: (input) =>
      `/api/apps/docs/spaces/${encode(input.spaceId)}/node/versions`,
    paramsFn: (input) => ({ relPath: relPath(input) }),
  }),

  getVersion: createQuery<
    { spaceId: string; versionId: string },
    DocNodeVersionDetailOutput
  >({
    path: "/api/apps/docs/spaces/{spaceId}/node/version/{versionId}",
    pathFn: (input) =>
      `/api/apps/docs/spaces/${encode(input.spaceId)}/node/version/${encode(input.versionId)}`,
  }),

  restoreVersion: createPathMutation<
    RelPathInput & { versionId: string },
    unknown
  >({
    method: "POST",
    pathFn: (input) =>
      `/api/apps/docs/spaces/${encode(input.spaceId)}/node/version/${encode(input.versionId)}/restore`,
  }),

  getViewState: createQuery<RelPathInput, unknown>({
    path: "/api/apps/docs/spaces/{spaceId}/node/view-state",
    pathFn: (input) =>
      `/api/apps/docs/spaces/${encode(input.spaceId)}/node/view-state`,
    paramsFn: (input) => ({ relPath: relPath(input) }),
  }),

  putViewState: createPathMutation<
    RelPathInput & { viewState: Record<string, unknown> },
    void
  >({
    method: "PUT",
    pathFn: (input) =>
      appendRel(
        `/api/apps/docs/spaces/${encode(input.spaceId)}/node/view-state`,
        input,
      ),
    bodyFn: (input) => ({ viewState: input.viewState }),
  }),

  bitable: {
    getMeta: createQuery<{ spaceId: string; relPath: string }, BaseMetaOutput>({
      path: "/api/apps/docs/spaces/{spaceId}/base",
      pathFn: (input) =>
        `/api/apps/docs/spaces/${encode(input.spaceId)}/base`,
      paramsFn: (input) => ({ relPath: input.relPath }),
    }),

    updateMeta: createMutation<
      {
        spaceId: string;
        relPath: string;
        fields?: unknown;
        views?: unknown;
        activeViewId?: string | null;
      },
      BaseMetaOutput
    >({
      method: "PATCH",
      path: "/api/apps/docs/spaces/{spaceId}/base",
      pathFn: (input) =>
        `/api/apps/docs/spaces/${encode(input.spaceId)}/base?relPath=${encode(input.relPath)}`,
      bodyFn: (input) => {
        const { spaceId: _, relPath: __, ...body } = input;
        return body;
      },
    }),

    listRecords: createQuery<
      { spaceId: string; relPath: string; page?: number; pageSize?: number },
      PageResult<BaseRecordOutput>
    >({
      path: "/api/apps/docs/spaces/{spaceId}/base/records",
      pathFn: (input) =>
        `/api/apps/docs/spaces/${encode(input.spaceId)}/base/records`,
      paramsFn: (input) => {
        const p: Record<string, string> = { relPath: input.relPath };
        if (input.page != null) p.page = String(input.page);
        if (input.pageSize != null) p.pageSize = String(input.pageSize);
        return p;
      },
    }),

    createRecord: createMutation<
      { spaceId: string; relPath: string; data?: Record<string, unknown> },
      BaseRecordOutput
    >({
      method: "POST",
      path: "/api/apps/docs/spaces/{spaceId}/base/records",
      pathFn: (input) =>
        `/api/apps/docs/spaces/${encode(input.spaceId)}/base/records?relPath=${encode(input.relPath)}`,
      bodyFn: (input) => ({ data: input.data ?? {} }),
    }),

    updateRecord: createMutation<
      {
        spaceId: string;
        recordId: string;
        data?: Record<string, unknown>;
        sortOrder?: number;
      },
      BaseRecordOutput
    >({
      method: "PATCH",
      path: "/api/apps/docs/spaces/{spaceId}/base/record/{recordId}",
      pathFn: (input) =>
        `/api/apps/docs/spaces/${encode(input.spaceId)}/base/record/${encode(input.recordId)}`,
      bodyFn: (input) => {
        const { spaceId: _, recordId: __, ...body } = input;
        return body;
      },
    }),

    deleteRecord: createPathMutation<
      { spaceId: string; recordId: string },
      void
    >({
      method: "DELETE",
      pathFn: (input) =>
        `/api/apps/docs/spaces/${encode(input.spaceId)}/base/record/${encode(input.recordId)}`,
    }),

    batchDeleteRecords: createMutation<
      { spaceId: string; relPath: string; ids: string[] },
      BatchDeleteOutput
    >({
      method: "POST",
      path: "/api/apps/docs/spaces/{spaceId}/base/records/batch-delete",
      pathFn: (input) =>
        `/api/apps/docs/spaces/${encode(input.spaceId)}/base/records/batch-delete?relPath=${encode(input.relPath)}`,
      bodyFn: (input) => ({ ids: input.ids }),
    }),
  },

  whiteboardLibrary: {
    listLibraries: createQuery<void, LibraryCatalogItem[]>({
      path: "/api/apps/docs/whiteboard/libraries",
    }),

    getUserLibrary: createQuery<void, { items: unknown[] }>({
      path: "/api/apps/docs/whiteboard/user-library",
    }),

    saveUserLibrary: createMutation<{ items: unknown[] }, void>({
      path: "/api/apps/docs/whiteboard/user-library",
      method: "PUT",
    }),
  },
};

// ── Attachment API ───────────────────────────────────────────────────────────

const docAttachmentApi = {
  list: createQuery<RelPathInput, DocNodeAttachmentOutput[]>({
    method: "GET",
    path: "/api/apps/docs/spaces/{spaceId}/node/attachments",
    pathFn: (input) =>
      `/api/apps/docs/spaces/${encode(input.spaceId)}/node/attachments`,
    paramsFn: (input) => ({ relPath: relPath(input) }),
  }),

  upload: {
    mutate: (input: {
      spaceId: string;
      relPath?: string;
      nodeId?: string;
      file: File;
      onProgress?: (percent: number) => void;
    }): Promise<DocNodeAttachmentOutput> =>
      new Promise((resolve, reject) => {
        const rp = input.relPath ?? input.nodeId ?? "";
        const url = `/api/apps/docs/spaces/${encode(input.spaceId)}/node/attachments?relPath=${encode(rp)}`;
        const form = new FormData();
        form.append("file", input.file, input.file.name);

        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);
        xhr.withCredentials = true;
        if (input.onProgress) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable)
              input.onProgress?.(Math.round((e.loaded / e.total) * 100));
          };
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const resp = JSON.parse(xhr.responseText) as
                | { data?: DocNodeAttachmentOutput }
                | DocNodeAttachmentOutput;
              resolve(
                "data" in resp && resp.data
                  ? resp.data
                  : (resp as DocNodeAttachmentOutput),
              );
            } catch {
              reject(new Error("Invalid response"));
            }
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error("Upload failed: network error"));
        xhr.send(form);
      }),
  },

  delete: createPathMutation<{ spaceId: string; id: string }, void>({
    method: "DELETE",
    pathFn: (input) =>
      `/api/apps/docs/spaces/${encode(input.spaceId)}/attachments/${encode(input.id)}`,
  }),

  restore: createPathMutation<{ spaceId: string; id: string }, void>({
    method: "POST",
    pathFn: (input) =>
      `/api/apps/docs/spaces/${encode(input.spaceId)}/attachments/${encode(input.id)}/restore`,
  }),
};

// ── VFS API (minimal — only what docs app uses) ─────────────────────────────

const vfsApi = {
  list: createQuery<void, VfsDto[]>({
    path: "/api/vfs",
  }),

  browse: createQuery<
    { fileSystemId: string; path: string },
    { items: Array<{ name: string; path: string; isDirectory: boolean }> }
  >({
    method: "GET",
    path: "/api/vfs/browse",
    pathFn: (input) =>
      `/api/vfs/${encodeURIComponent(input.fileSystemId)}/browse`,
    paramsFn: (input) => ({ path: input.path }),
  }),
};

// ── Auth API (minimal — only profile) ────────────────────────────────────────

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
}

export const userApi = {
  getProfile: {
    fetch: (): Promise<UserProfile> => callApi<UserProfile>("/api/user/profile"),
  },
};

// ── Combined API ─────────────────────────────────────────────────────────────

export const api = {
  docs: docsApi,
  vfs: vfsApi,
  user: userApi,
};

export { docAttachmentApi };
