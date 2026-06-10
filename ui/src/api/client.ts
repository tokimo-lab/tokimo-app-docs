/**
 * API client for the docs app backend.
 *
 * In standalone app mode, all requests go through the app's own server
 * which listens on a UDS socket. The browser accesses it via the host's
 * reverse proxy at `/api/apps/docs/`.
 */

const BASE_URL = "/api/apps/docs";

interface ApiResponse<T> {
  data: T;
}

interface ApiError {
  error: string;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      error: `HTTP ${response.status}: ${response.statusText}`,
    }));
    throw new Error(error.error);
  }

  const result: ApiResponse<T> = await response.json();
  return result.data;
}

// -- Spaces --

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

export async function listSpaces(): Promise<DocSpaceOutput[]> {
  return request<DocSpaceOutput[]>("/spaces");
}

export async function createSpace(input: {
  name: string;
  avatar?: unknown;
  description?: string;
  vfsId?: string;
  rootPath?: string;
}): Promise<DocSpaceOutput> {
  return request<DocSpaceOutput>("/spaces", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateSpace(
  id: string,
  input: {
    name?: string;
    avatar?: unknown;
    description?: string;
    vfsId?: string;
    rootPath?: string;
    sortOrder?: number;
  },
): Promise<DocSpaceOutput> {
  return request<DocSpaceOutput>(`/spaces/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteSpace(id: string): Promise<void> {
  return request<void>(`/spaces/${id}`, {
    method: "DELETE",
  });
}

// -- Nodes --

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

export interface ListNodeParams {
  path?: string;
  tab?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  tags?: string;
}

export async function listNodes(
  spaceId: string,
  params?: ListNodeParams,
): Promise<{
  items: DocNodeListItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const query = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        query.set(key, String(value));
      }
    }
  }
  const qs = query.toString();
  return request(`/spaces/${spaceId}/nodes${qs ? `?${qs}` : ""}`);
}

export async function listNodeTags(spaceId: string): Promise<string[]> {
  return request<string[]>(`/spaces/${spaceId}/nodes/tags`);
}

export async function createNode(
  spaceId: string,
  input: {
    parentRelPath?: string;
    type: string;
    title: string;
    content?: unknown;
  },
): Promise<DocNodeListItem> {
  return request<DocNodeListItem>(`/spaces/${spaceId}/nodes`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getNode(
  spaceId: string,
  relPath: string,
): Promise<{
  spaceId: string;
  relPath: string;
  parentId?: string;
  type: string;
  title: string;
  content: unknown;
  meta?: unknown;
  updatedAt: string;
}> {
  return request(`/spaces/${spaceId}/node?relPath=${encodeURIComponent(relPath)}`);
}

export async function updateNode(
  spaceId: string,
  relPath: string,
  input: {
    content?: unknown;
    title?: string;
    tags?: string[];
    icon?: string | null;
    coverImage?: string | null;
  },
): Promise<unknown> {
  return request(
    `/spaces/${spaceId}/node?relPath=${encodeURIComponent(relPath)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export async function moveNode(
  spaceId: string,
  from: string,
  to: string,
): Promise<void> {
  return request(
    `/spaces/${spaceId}/node/move?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    { method: "PATCH" },
  );
}

export async function archiveNode(
  spaceId: string,
  relPath: string,
): Promise<void> {
  return request(
    `/spaces/${spaceId}/node?relPath=${encodeURIComponent(relPath)}`,
    { method: "DELETE" },
  );
}

export async function restoreNode(
  spaceId: string,
  relPath: string,
): Promise<void> {
  return request(
    `/spaces/${spaceId}/node/restore?relPath=${encodeURIComponent(relPath)}`,
    { method: "PATCH" },
  );
}

export async function deleteNode(
  spaceId: string,
  relPath: string,
): Promise<void> {
  return request(
    `/spaces/${spaceId}/node/permanent?relPath=${encodeURIComponent(relPath)}`,
    { method: "DELETE" },
  );
}

export async function toggleFavorite(
  spaceId: string,
  relPath: string,
): Promise<{ isFavorite: boolean }> {
  return request(
    `/spaces/${spaceId}/node/favorite?relPath=${encodeURIComponent(relPath)}`,
    { method: "PATCH" },
  );
}

export async function togglePin(
  spaceId: string,
  relPath: string,
): Promise<{ isPinned: boolean }> {
  return request(
    `/spaces/${spaceId}/node/pin?relPath=${encodeURIComponent(relPath)}`,
    { method: "PATCH" },
  );
}

// -- Versions --

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

export async function listVersions(
  spaceId: string,
  relPath: string,
): Promise<DocNodeVersionOutput[]> {
  return request(
    `/spaces/${spaceId}/node/versions?relPath=${encodeURIComponent(relPath)}`,
  );
}

export async function getVersion(
  spaceId: string,
  versionId: string,
): Promise<DocNodeVersionDetailOutput> {
  return request(`/spaces/${spaceId}/node/version/${versionId}`);
}

export async function restoreVersion(
  spaceId: string,
  versionId: string,
): Promise<void> {
  return request(`/spaces/${spaceId}/node/version/${versionId}/restore`, {
    method: "POST",
  });
}

// -- Comments --

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

export async function listComments(
  spaceId: string,
  relPath: string,
): Promise<DocNodeCommentOutput[]> {
  return request(
    `/spaces/${spaceId}/node/comments?relPath=${encodeURIComponent(relPath)}`,
  );
}

export async function createComment(
  spaceId: string,
  relPath: string,
  input: {
    commentKey: string;
    content: string;
    parentId?: string;
  },
): Promise<{ id: string; commentKey: string; createdAt: string }> {
  return request(
    `/spaces/${spaceId}/node/comments?relPath=${encodeURIComponent(relPath)}`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function resolveComment(
  spaceId: string,
  commentId: string,
  resolved: boolean,
): Promise<void> {
  return request(`/spaces/${spaceId}/node/comment/${commentId}/resolve`, {
    method: "PATCH",
    body: JSON.stringify({ resolved }),
  });
}

export async function deleteComment(
  spaceId: string,
  commentId: string,
): Promise<void> {
  return request(`/spaces/${spaceId}/node/comment/${commentId}`, {
    method: "DELETE",
  });
}

// -- Attachments --

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

export async function listAttachments(
  spaceId: string,
  relPath: string,
): Promise<DocNodeAttachmentOutput[]> {
  return request(
    `/spaces/${spaceId}/node/attachments?relPath=${encodeURIComponent(relPath)}`,
  );
}

export async function uploadAttachment(
  spaceId: string,
  relPath: string,
  file: File,
): Promise<DocNodeAttachmentOutput> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    `${BASE_URL}/spaces/${spaceId}/node/attachments?relPath=${encodeURIComponent(relPath)}`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      error: `HTTP ${response.status}: ${response.statusText}`,
    }));
    throw new Error(error.error);
  }

  const result: ApiResponse<DocNodeAttachmentOutput> = await response.json();
  return result.data;
}

export async function deleteAttachment(
  spaceId: string,
  attachmentId: string,
): Promise<void> {
  return request(`/spaces/${spaceId}/attachments/${attachmentId}`, {
    method: "DELETE",
  });
}

export async function restoreAttachment(
  spaceId: string,
  attachmentId: string,
): Promise<void> {
  return request(`/spaces/${spaceId}/attachments/${attachmentId}/restore`, {
    method: "POST",
  });
}

// -- View State --

export async function getViewState(
  spaceId: string,
  relPath: string,
): Promise<unknown> {
  return request(
    `/spaces/${spaceId}/node/view-state?relPath=${encodeURIComponent(relPath)}`,
  );
}

export async function putViewState(
  spaceId: string,
  relPath: string,
  viewState: unknown,
): Promise<void> {
  return request(
    `/spaces/${spaceId}/node/view-state?relPath=${encodeURIComponent(relPath)}`,
    {
      method: "PUT",
      body: JSON.stringify({ viewState }),
    },
  );
}

// -- Base (Spreadsheet) --

export interface BaseMetaOutput {
  relPath: string;
  fields: unknown;
  views: unknown;
  activeViewId?: string;
}

export async function getBaseMeta(
  spaceId: string,
  relPath: string,
): Promise<BaseMetaOutput> {
  return request(
    `/spaces/${spaceId}/base?relPath=${encodeURIComponent(relPath)}`,
  );
}

export async function updateBaseMeta(
  spaceId: string,
  relPath: string,
  input: {
    fields?: unknown;
    views?: unknown;
    activeViewId?: string;
  },
): Promise<BaseMetaOutput> {
  return request(
    `/spaces/${spaceId}/base?relPath=${encodeURIComponent(relPath)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
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

export async function listBaseRecords(
  spaceId: string,
  relPath: string,
  page?: number,
  pageSize?: number,
): Promise<{
  items: BaseRecordOutput[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const query = new URLSearchParams();
  if (page) query.set("page", String(page));
  if (pageSize) query.set("pageSize", String(pageSize));
  const qs = query.toString();
  return request(
    `/spaces/${spaceId}/base/records?relPath=${encodeURIComponent(relPath)}${qs ? `&${qs}` : ""}`,
  );
}

export async function createBaseRecord(
  spaceId: string,
  relPath: string,
  data?: unknown,
): Promise<BaseRecordOutput> {
  return request(
    `/spaces/${spaceId}/base/records?relPath=${encodeURIComponent(relPath)}`,
    {
      method: "POST",
      body: JSON.stringify({ data }),
    },
  );
}

export async function updateBaseRecord(
  spaceId: string,
  recordId: string,
  input: { data?: unknown; sortOrder?: number },
): Promise<BaseRecordOutput> {
  return request(`/spaces/${spaceId}/base/record/${recordId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteBaseRecord(
  spaceId: string,
  recordId: string,
): Promise<void> {
  return request(`/spaces/${spaceId}/base/record/${recordId}`, {
    method: "DELETE",
  });
}

export async function batchDeleteBaseRecords(
  spaceId: string,
  ids: string[],
): Promise<{ deleted: number }> {
  return request(`/spaces/${spaceId}/base/records/batch-delete`, {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

// -- Whiteboard Libraries --

export interface LibraryCatalogItem {
  id: string;
  name: string;
  description: string;
  authors: { name: string; url?: string }[];
  previewUrl: string;
  itemCount?: number;
  itemNames?: string[];
  created: string;
  updated: string;
}

export async function listWhiteboardLibraries(): Promise<
  LibraryCatalogItem[]
> {
  return request<LibraryCatalogItem[]>("/whiteboard/libraries");
}

export async function downloadWhiteboardLibrary(
  libraryId: string,
): Promise<void> {
  window.open(
    `${BASE_URL}/whiteboard/libraries/${libraryId}/download`,
    "_blank",
  );
}

export async function getWhiteboardUserLibrary(): Promise<unknown> {
  return request("/whiteboard/user-library");
}

export async function saveWhiteboardUserLibrary(
  items: unknown,
): Promise<void> {
  return request("/whiteboard/user-library", {
    method: "PUT",
    body: JSON.stringify({ items }),
  });
}
