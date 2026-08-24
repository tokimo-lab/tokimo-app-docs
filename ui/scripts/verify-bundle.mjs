import { readFileSync } from "node:fs";

const bundle = readFileSync(new URL("../dist/index.js", import.meta.url), "utf8");
const runtimeRequireReact = /\b[A-Za-z_$][\w$]*\("react"\)[\s\S]{0,1000}react\.memo_cache_sentinel/;

if (!bundle.includes("tokimo:react-compiler-runtime")) {
  throw new Error("Docs bundle is missing the ESM React compiler runtime shim");
}

if (runtimeRequireReact.test(bundle)) {
  throw new Error('Docs bundle contains a browser runtime require("react") call');
}

console.log("Docs bundle verification passed");
