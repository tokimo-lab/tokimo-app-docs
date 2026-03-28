/**
 * useDocAi — One-shot AI completion hook for document writing assistance.
 *
 * Uses the lightweight /api/ai/complete/stream endpoint (no conversation management).
 */

import { useCallback, useRef, useState } from "react";
import { rustUrl } from "@/lib/rust-api-runtime";

export interface DocAiInput {
  prompt: string;
  systemPrompt?: string;
  model: string;
  provider: string;
  temperature?: number;
  maxTokens?: number;
}

export function useDocAi() {
  const [content, setContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const contentRef = useRef("");

  const complete = useCallback(async (input: DocAiInput) => {
    setIsStreaming(true);
    setContent("");
    setError(null);
    contentRef.current = "";

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch(rustUrl("/api/ai/complete/stream"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || `Request failed (${resp.status})`);
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (!data) continue;

          try {
            const event = JSON.parse(data);
            if (event.type === "content_delta" && event.delta) {
              contentRef.current += event.delta;
              setContent(contentRef.current);
            } else if (event.type === "error") {
              setError(event.message);
            }
          } catch {
            // skip non-JSON lines
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        const msg = (e as Error).message || "AI request failed";
        console.error("Doc AI error:", msg);
        setError(msg);
      }
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
    }
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    setContent("");
    setError(null);
  }, []);

  return { content, isStreaming, error, complete, abort, reset };
}
