import { createPathMutation, createQuery } from "../../lib/rust-api-runtime";
import type {
  DocFolderOutput,
  DocListItem,
  DocOutput,
} from "../rust-types/index";

// ── Input types (not from Rust DTOs) ────────────────────────────────────────

interface CreateDocInput {
  appId: string;
  title?: string;
  folderId?: string | null;
}

interface UpdateDocInput {
  id: string;
  title?: string;
  content?: unknown;
  icon?: string | null;
  coverImage?: string | null;
}

interface MoveDocInput {
  id: string;
  folderId: string | null;
}

interface CreateDocFolderInput {
  appId: string;
  name: string;
  parentId?: string | null;
  icon?: string | null;
}

interface UpdateDocFolderInput {
  id: string;
  name?: string;
  icon?: string | null;
  sortOrder?: number;
}

interface ListDocsQuery {
  appId: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
  search?: string;
  folderId?: string | null;
  favoritesOnly?: boolean;
}

interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ── Doc API ─────────────────────────────────────────────────────────────────

export const docApi = {
  list: createQuery<ListDocsQuery, PageResult<DocListItem>>({
    path: "/api/apps/{appId}/docs",
    pathFn: (input) => `/api/apps/${encodeURIComponent(input.appId)}/docs`,
    paramsFn: (input) => {
      const p: Record<string, string> = {};
      if (input.page != null) p.page = String(input.page);
      if (input.pageSize != null) p.pageSize = String(input.pageSize);
      if (input.sortBy) p.sortBy = input.sortBy;
      if (input.sortDir) p.sortDir = input.sortDir;
      if (input.search) p.search = input.search;
      if (input.folderId) p.folderId = input.folderId;
      if (input.favoritesOnly) p.favoritesOnly = "true";
      return p;
    },
  }),

  getById: createQuery<{ id: string }, DocOutput>({
    path: "/api/docs/{id}",
    pathFn: (input) => `/api/docs/${encodeURIComponent(input.id)}`,
  }),

  create: createPathMutation<CreateDocInput, DocOutput>({
    method: "POST",
    pathFn: (input) => `/api/apps/${encodeURIComponent(input.appId)}/docs`,
    bodyFn: (input) => {
      const { appId: _, ...body } = input;
      return body;
    },
  }),

  update: createPathMutation<UpdateDocInput, DocOutput>({
    method: "PATCH",
    pathFn: (input) => `/api/docs/${encodeURIComponent(input.id)}`,
    bodyFn: (input) => {
      const { id: _, ...body } = input;
      return body;
    },
  }),

  delete: createPathMutation<{ id: string }, void>({
    method: "DELETE",
    pathFn: (input) => `/api/docs/${encodeURIComponent(input.id)}`,
  }),

  toggleFavorite: createPathMutation<{ id: string }, { isFavorite: boolean }>({
    method: "PATCH",
    pathFn: (input) => `/api/docs/${encodeURIComponent(input.id)}/favorite`,
  }),

  togglePin: createPathMutation<{ id: string }, { isPinned: boolean }>({
    method: "PATCH",
    pathFn: (input) => `/api/docs/${encodeURIComponent(input.id)}/pin`,
  }),

  move: createPathMutation<MoveDocInput, void>({
    method: "PATCH",
    pathFn: (input) => `/api/docs/${encodeURIComponent(input.id)}/move`,
    bodyFn: (input) => ({ folderId: input.folderId }),
  }),

  // ── Folders ─────────────────────────────────────────────────────────────

  listFolders: createQuery<{ appId: string }, DocFolderOutput[]>({
    path: "/api/apps/{appId}/doc-folders",
    pathFn: (input) =>
      `/api/apps/${encodeURIComponent(input.appId)}/doc-folders`,
  }),

  createFolder: createPathMutation<CreateDocFolderInput, DocFolderOutput>({
    method: "POST",
    pathFn: (input) =>
      `/api/apps/${encodeURIComponent(input.appId)}/doc-folders`,
    bodyFn: (input) => {
      const { appId: _, ...body } = input;
      return body;
    },
  }),

  updateFolder: createPathMutation<UpdateDocFolderInput, DocFolderOutput>({
    method: "PATCH",
    pathFn: (input) => `/api/doc-folders/${encodeURIComponent(input.id)}`,
    bodyFn: (input) => {
      const { id: _, ...body } = input;
      return body;
    },
  }),

  deleteFolder: createPathMutation<{ id: string }, void>({
    method: "DELETE",
    pathFn: (input) => `/api/doc-folders/${encodeURIComponent(input.id)}`,
  }),
};
