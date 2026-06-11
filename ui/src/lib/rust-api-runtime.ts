/**
 * Rust API Runtime — typed React Query hooks for calling the docs app backend.
 *
 * Self-contained version for standalone app (no monolith imports).
 * Provides `createQuery` / `createPathMutation` factories that produce
 * `.useQuery()` / `.useMutation()` hooks.
 */

import {
  type QueryKey,
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef } from "react";

// ── Base URL ─────────────────────────────────────────────────────────────────

const API_PREFIX = "/api/apps/docs";

// ── Fetch helpers ────────────────────────────────────────────────────────────

export class RustApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "RustApiError";
  }
}

export async function callApi<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      ...init,
    });
  } catch {
    throw new RustApiError("Network error", 0);
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new RustApiError("Invalid JSON response", res.status);
  }
  // Handle both {success: true, data: T} and {data: T} formats.
  // The backend uses HTTP status codes for success/failure, so we just
  // need to extract the data field.
  const obj = json as Record<string, unknown>;
  if (obj && typeof obj === "object" && "data" in obj) {
    return obj.data as T;
  }
  // Fallback: return the entire response as T
  return json as T;
}

// ── Hook factories ───────────────────────────────────────────────────────────

interface QueryRouteConfig<TInput> {
  method?: string;
  path: string;
  pathFn?: (input: TInput) => string;
  paramsFn?: (input: TInput) => Record<string, string>;
}

interface MutationRouteConfig<TInput> {
  method?: string;
  path: string;
  pathFn?: (input: TInput) => string;
  bodyFn?: (input: TInput) => unknown;
}

export function createQuery<TInput, TOutput>(cfg: QueryRouteConfig<TInput>) {
  const method = cfg.method ?? "GET";

  function queryKey(input?: TInput): QueryKey {
    return input != null ? [cfg.path, input] : [cfg.path];
  }

  function queryFn(input?: TInput): () => Promise<TOutput> {
    return () => {
      const actualPath =
        cfg.pathFn && input != null ? cfg.pathFn(input) : cfg.path;

      if (method === "GET") {
        let qs = "";
        if (cfg.paramsFn && input != null) {
          qs = `?${new URLSearchParams(cfg.paramsFn(input)).toString()}`;
        } else if (!cfg.pathFn && input != null) {
          qs = `?${new URLSearchParams(input as Record<string, string>).toString()}`;
        }
        return callApi<TOutput>(`${actualPath}${qs}`);
      }
      return callApi<TOutput>(actualPath, {
        method,
        body: input != null ? JSON.stringify(input) : undefined,
      });
    };
  }

  return {
    queryKey,
    useQuery: (
      ...args: TInput extends void
        ? [opts?: Partial<UseQueryOptions<TOutput>>]
        : [
            input: TInput,
            opts?: Partial<UseQueryOptions<TOutput>>,
          ]
    ) => {
      const [inputOrOpts, maybeOpts] = args as [unknown, unknown];
      const firstIsOptsObject =
        typeof inputOrOpts === "object" &&
        inputOrOpts !== null &&
        "queryKey" in inputOrOpts;
      const isVoidInput = inputOrOpts === undefined || firstIsOptsObject;
      const input = isVoidInput ? undefined : (inputOrOpts as TInput);
      const opts = (firstIsOptsObject ? inputOrOpts : maybeOpts) as
        | Partial<UseQueryOptions<TOutput>>
        | undefined;

      return useQuery<TOutput>({
        queryKey: queryKey(input),
        queryFn: queryFn(input),
        ...opts,
      });
    },
    fetch: (input?: TInput) => queryFn(input)(),
    invalidate: (qc: ReturnType<typeof useQueryClient>, input?: TInput) =>
      qc.invalidateQueries({ queryKey: queryKey(input) }),
    getData: (qc: ReturnType<typeof useQueryClient>, input?: TInput) =>
      qc.getQueryData<TOutput>(queryKey(input)),
    setData: (
      qc: ReturnType<typeof useQueryClient>,
      input: TInput | undefined,
      updater: TOutput | ((prev: TOutput | undefined) => TOutput | undefined),
    ) => qc.setQueryData(queryKey(input), updater),
  };
}

export function createMutation<TInput, TOutput>(
  cfg: MutationRouteConfig<TInput>,
) {
  const method = cfg.method ?? "POST";

  function mutationFn(input: TInput): Promise<TOutput> {
    const actualPath = cfg.pathFn ? cfg.pathFn(input) : cfg.path;
    const body = cfg.bodyFn ? cfg.bodyFn(input) : input;
    return callApi<TOutput>(actualPath, {
      method,
      body: body != null ? JSON.stringify(body) : undefined,
    });
  }

  return {
    useMutation: (
      opts?: Partial<UseMutationOptions<TOutput, RustApiError, TInput>>,
    ) => {
      return useMutation<TOutput, RustApiError, TInput>({
        mutationFn,
        ...opts,
      });
    },
    mutate: mutationFn,
  };
}

export function createPathMutation<TInput, TOutput>(cfg: {
  method?: string;
  pathFn: (input: TInput) => string;
  bodyFn?: (input: TInput) => unknown;
}) {
  const method = cfg.method ?? "POST";

  function mutationFn(input: TInput): Promise<TOutput> {
    const body = cfg.bodyFn ? cfg.bodyFn(input) : undefined;
    return callApi<TOutput>(cfg.pathFn(input), {
      method,
      body: body != null ? JSON.stringify(body) : undefined,
    });
  }

  return {
    useMutation: (
      opts?: Partial<UseMutationOptions<TOutput, RustApiError, TInput>>,
    ) => {
      return useMutation<TOutput, RustApiError, TInput>({
        mutationFn,
        ...opts,
      });
    },
    mutate: mutationFn,
  };
}
