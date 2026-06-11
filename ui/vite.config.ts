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

const base = defineTokimoApp();
export default {
  ...base,
  plugins: [...(base.plugins ?? []), univerjsDayjsShim()],
};
