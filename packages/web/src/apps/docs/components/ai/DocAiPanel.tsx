/**
 * DocAiPanel — AI writing assistant panel for the document editor.
 *
 * Shows as a right-side panel when toggled. Provides quick AI actions
 * (improve, summarize, translate, continue, etc.) and a custom prompt input.
 * Streams AI responses with Insert / Replace / Copy actions.
 */

import { cn } from "@tokiomo/components";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ClipboardCopy,
  Languages,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Square,
  Type,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/generated/rust-api";
import { useDocAi } from "./use-doc-ai";

// ── AI action presets ────────────────────────────────────────────────

interface AiAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  systemPrompt: string;
  /** If true, the prompt is built from selectedText. If false, from full doc text. */
  needsSelection: boolean;
  buildPrompt: (text: string) => string;
}

const ICON_CLS = "size-4";

const AI_ACTIONS: AiAction[] = [
  {
    id: "improve",
    label: "润色优化",
    icon: <Wand2 className={ICON_CLS} />,
    needsSelection: true,
    systemPrompt:
      "You are a professional writing assistant. Improve the given text: fix grammar, enhance clarity, and improve flow. Keep the original meaning and tone. Return only the improved text without explanations.",
    buildPrompt: (text) => text,
  },
  {
    id: "shorter",
    label: "精简缩写",
    icon: <Zap className={ICON_CLS} />,
    needsSelection: true,
    systemPrompt:
      "You are a concise writing editor. Make the text shorter and more concise while keeping all key information. Return only the shortened text.",
    buildPrompt: (text) => text,
  },
  {
    id: "longer",
    label: "扩写丰富",
    icon: <Plus className={ICON_CLS} />,
    needsSelection: true,
    systemPrompt:
      "You are a writing assistant. Expand the text with more details, examples, and elaboration while keeping the same style and tone. Return only the expanded text.",
    buildPrompt: (text) => text,
  },
  {
    id: "continue",
    label: "续写",
    icon: <ArrowRight className={ICON_CLS} />,
    needsSelection: false,
    systemPrompt:
      "You are a writing assistant. Continue writing from where the text left off. Match the style, tone, and topic. Write 2-4 paragraphs of natural continuation. Return only the continuation text.",
    buildPrompt: (text) => {
      const lastPart = text.slice(-2000);
      return `Continue writing from here:\n\n${lastPart}`;
    },
  },
  {
    id: "summarize",
    label: "总结摘要",
    icon: <Type className={ICON_CLS} />,
    needsSelection: false,
    systemPrompt:
      "You are a professional summarizer. Create a clear, concise summary of the text. Use bullet points for key takeaways. Keep the summary under 200 words.",
    buildPrompt: (text) => text,
  },
  {
    id: "translate-en",
    label: "翻译为英文",
    icon: <Languages className={ICON_CLS} />,
    needsSelection: true,
    systemPrompt:
      "You are a professional translator. Translate the text to English. Maintain the original formatting and structure. Return only the translated text.",
    buildPrompt: (text) => text,
  },
  {
    id: "translate-zh",
    label: "翻译为中文",
    icon: <Languages className={ICON_CLS} />,
    needsSelection: true,
    systemPrompt:
      "You are a professional translator. Translate the text to Simplified Chinese (简体中文). Maintain the original formatting and structure. Return only the translated text.",
    buildPrompt: (text) => text,
  },
  {
    id: "fix-grammar",
    label: "修正语法",
    icon: <Check className={ICON_CLS} />,
    needsSelection: true,
    systemPrompt:
      "You are a grammar checker. Fix all grammar, spelling, and punctuation errors in the text. Return only the corrected text.",
    buildPrompt: (text) => text,
  },
];

// ── Provider / model persistence ─────────────────────────────────────

const STORAGE_KEY = "doc-ai-provider-model";

function loadSavedProviderModel(): {
  provider: string;
  model: string;
} | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return null;
}

function saveProviderModel(provider: string, model: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ provider, model }));
}

// ── Component ────────────────────────────────────────────────────────

interface DocAiPanelProps {
  open: boolean;
  onClose: () => void;
  /** Selected text from the editor (if any). */
  selectedText: string;
  /** Full document text for context. */
  fullText: string;
  /** Called when user wants to insert AI result at cursor. */
  onInsert: (text: string) => void;
  /** Called when user wants to replace selection with AI result. */
  onReplace: (text: string) => void;
}

export function DocAiPanel({
  open,
  onClose,
  selectedText,
  fullText,
  onInsert,
  onReplace,
}: DocAiPanelProps) {
  const { content, isStreaming, error, complete, abort, reset } = useDocAi();
  const [customPrompt, setCustomPrompt] = useState("");
  const [modelOpen, setModelOpen] = useState(false);
  const modelBtnRef = useRef<HTMLButtonElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // ── Provider / model ───────────────────────────────────────────────
  const providersQuery = api.ai.providers.list.useQuery({
    enabled: open,
  });
  const enabledProviders = useMemo(
    () => (providersQuery.data ?? []).filter((p) => p.enabled),
    [providersQuery.data],
  );

  const saved = useMemo(() => loadSavedProviderModel(), []);
  const [provider, setProvider] = useState(saved?.provider ?? "");
  const [model, setModel] = useState(saved?.model ?? "");

  // Auto-select first provider/model if none saved
  useEffect(() => {
    if (provider && model) return;
    if (enabledProviders.length === 0) return;
    const first = enabledProviders[0];
    if (!provider) setProvider(first.providerKey);
  }, [enabledProviders, provider, model]);

  const modelsQuery = api.ai.providers.models.useQuery(
    { providerKey: provider },
    { enabled: !!provider && open },
  );

  const availableModels = useMemo(
    () => modelsQuery.data ?? [],
    [modelsQuery.data],
  );

  // Auto-select first model
  useEffect(() => {
    if (model && availableModels.some((m) => m.id === model)) return;
    if (availableModels.length > 0) {
      setModel(availableModels[0].id);
    }
  }, [availableModels, model]);

  // Save selection
  useEffect(() => {
    if (provider && model) saveProviderModel(provider, model);
  }, [provider, model]);

  // Auto-scroll result
  useEffect(() => {
    if (content && resultRef.current) {
      resultRef.current.scrollTop = resultRef.current.scrollHeight;
    }
  }, [content]);

  // ── Actions ────────────────────────────────────────────────────────

  const runAction = useCallback(
    (action: AiAction) => {
      if (!provider || !model) return;
      const text = action.needsSelection ? selectedText : fullText;
      if (!text.trim()) return;
      reset();
      complete({
        prompt: action.buildPrompt(text),
        systemPrompt: action.systemPrompt,
        model,
        provider,
        temperature: 0.7,
        maxTokens: 4000,
      });
    },
    [provider, model, selectedText, fullText, complete, reset],
  );

  const runCustom = useCallback(() => {
    if (!provider || !model || !customPrompt.trim()) return;
    const context = selectedText || fullText;
    const prompt = context
      ? `${customPrompt}\n\n---\n\n${context.slice(0, 4000)}`
      : customPrompt;
    reset();
    complete({
      prompt,
      systemPrompt:
        "You are a helpful writing assistant. Follow the user's instructions. If they provide text context, work with that text. Return only the result.",
      model,
      provider,
      temperature: 0.7,
      maxTokens: 4000,
    });
  }, [provider, model, customPrompt, selectedText, fullText, complete, reset]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        runCustom();
      }
    },
    [runCustom],
  );

  if (!open) return null;

  const hasSelection = selectedText.trim().length > 0;
  const hasResult = content.length > 0 || isStreaming;
  const noProvider = enabledProviders.length === 0;

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
        <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          <Sparkles size={16} className="text-purple-500" />
          AI 助手
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <X size={16} />
        </button>
      </div>

      {noProvider ? (
        <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-zinc-400">
          <p>请先在设置中配置 AI 服务提供商</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Model selector */}
          <div className="relative border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
            <button
              ref={modelBtnRef}
              type="button"
              onClick={() => setModelOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-800"
            >
              <span className="truncate text-zinc-700 dark:text-zinc-300">
                {model || "选择模型"}
              </span>
              <ChevronDown size={14} className="text-zinc-400" />
            </button>
            {modelOpen && (
              <div className="absolute right-3 left-3 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                {enabledProviders.map((p) => (
                  <div key={p.providerKey}>
                    <div className="px-2 py-1 text-[10px] font-semibold text-zinc-400 uppercase">
                      {p.providerKey}
                    </div>
                    {(provider === p.providerKey ? availableModels : []).map(
                      (m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setProvider(p.providerKey);
                            setModel(m.id);
                            setModelOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center px-2 py-1.5 text-left text-xs transition-colors",
                            model === m.id && provider === p.providerKey
                              ? "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300"
                              : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-700/50",
                          )}
                        >
                          <span className="truncate">{m.name || m.id}</span>
                        </button>
                      ),
                    )}
                    {provider !== p.providerKey && (
                      <button
                        type="button"
                        onClick={() => {
                          setProvider(p.providerKey);
                        }}
                        className="w-full px-2 py-1.5 text-left text-xs text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
                      >
                        加载模型列表…
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selection indicator */}
          {hasSelection && (
            <div className="border-b border-zinc-100 px-3 py-1.5 dark:border-zinc-800">
              <span className="text-[11px] text-purple-600 dark:text-purple-400">
                ✦ 已选中 {selectedText.length} 个字符
              </span>
            </div>
          )}

          {/* Quick actions */}
          <div className="flex-1 overflow-y-auto">
            {!hasResult && (
              <div className="p-3">
                <div className="mb-2 text-[11px] font-medium text-zinc-400 uppercase dark:text-zinc-500">
                  快速操作
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {AI_ACTIONS.map((action) => {
                    const disabled =
                      action.needsSelection && !hasSelection && !fullText;
                    return (
                      <button
                        key={action.id}
                        type="button"
                        disabled={disabled || isStreaming}
                        onClick={() => runAction(action)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md border px-2 py-2 text-left text-xs transition-colors",
                          disabled
                            ? "cursor-not-allowed border-zinc-100 text-zinc-300 dark:border-zinc-800 dark:text-zinc-600"
                            : "border-zinc-200 text-zinc-600 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-purple-800 dark:hover:bg-purple-900/20 dark:hover:text-purple-300",
                        )}
                      >
                        {action.icon}
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Result area */}
            {hasResult && (
              <div className="flex flex-col p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-zinc-400 uppercase">
                    AI 结果
                  </span>
                  {isStreaming && (
                    <button
                      type="button"
                      onClick={abort}
                      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Square size={10} />
                      停止
                    </button>
                  )}
                </div>
                <div
                  ref={resultRef}
                  className="max-h-64 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm whitespace-pre-wrap text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {content}
                  {isStreaming && (
                    <span className="inline-block h-4 w-1 animate-pulse bg-purple-500" />
                  )}
                </div>
                {error && (
                  <div className="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    {error}
                  </div>
                )}
                {/* Action buttons */}
                {!isStreaming && content && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {hasSelection && (
                      <button
                        type="button"
                        onClick={() => onReplace(content)}
                        className="flex items-center gap-1 rounded-md bg-purple-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-purple-700"
                      >
                        <Pencil size={12} />
                        替换选中
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onInsert(content)}
                      className="flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      <Plus size={12} />
                      插入
                    </button>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      {copied ? (
                        <Check size={12} />
                      ) : (
                        <ClipboardCopy size={12} />
                      )}
                      {copied ? "已复制" : "复制"}
                    </button>
                    <button
                      type="button"
                      onClick={reset}
                      className="flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      <RotateCcw size={12} />
                      重来
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Custom prompt input */}
          <div className="border-t border-zinc-100 p-3 dark:border-zinc-800">
            <div className="flex gap-1.5">
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入自定义指令…"
                rows={2}
                className="flex-1 resize-none rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-sm text-zinc-700 outline-none placeholder:text-zinc-400 focus:border-purple-300 focus:ring-1 focus:ring-purple-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:placeholder:text-zinc-500 dark:focus:border-purple-600 dark:focus:ring-purple-600"
              />
              <button
                type="button"
                disabled={!customPrompt.trim() || isStreaming || !model}
                onClick={runCustom}
                className="flex shrink-0 items-center justify-center rounded-md bg-purple-600 px-3 text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isStreaming ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
