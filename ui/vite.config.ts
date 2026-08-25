import { readFileSync } from "node:fs";
import { defineTokimoApp } from "@tokimo/app-builder/vite";
import type { Plugin } from "vite";

/**
 * @univerjs/core@0.20.1 removed the `dayjs` re-export that @univerjs/sheets-ui
 * 0.20.0 still depends on. This plugin patches the ESM bundle at load time to
 * re-export `dayjs` from the standalone package.
 */
function univerjsDayjsShim(): Plugin {
  return {
    name: "univerjs-dayjs-shim",
    load(id) {
      if (
        id.includes("@univerjs/core") &&
        id.endsWith("lib/es/index.js")
      ) {
        const code = readFileSync(id, "utf-8");
        if (/\bdayjs\b/.test(code)) return null;
        return code + "\nexport { default as dayjs } from 'dayjs';\n";
      }
      return null;
    },
  };
}

/**
 * Plate's compiled packages import the CommonJS-only
 * `react-compiler-runtime`, which calls `require("react")` at runtime when
 * React is externalized by the Tokimo app bundle. Only its memo-cache helper
 * is used, so provide the React 19-compatible ESM implementation directly.
 */
function reactCompilerRuntimeShim(): Plugin {
  const virtualId = "\0tokimo:react-compiler-runtime";
  return {
    name: "react-compiler-runtime-shim",
    enforce: "pre",
    resolveId(id) {
      return id === "react-compiler-runtime" ? virtualId : null;
    },
    load(id) {
      if (id !== virtualId) return null;
      return `
        import { useMemo } from "react";
        const sentinel = Symbol.for("react.memo_cache_sentinel");
        export function c(size) {
          return useMemo(() => {
            const cache = Array(size).fill(sentinel);
            cache[sentinel] = true;
            return cache;
          }, []);
        }
      `;
    },
  };
}

const base = defineTokimoApp();
export default {
  ...base,
  plugins: [
    ...(base.plugins ?? []),
    reactCompilerRuntimeShim(),
    univerjsDayjsShim(),
  ],
};
