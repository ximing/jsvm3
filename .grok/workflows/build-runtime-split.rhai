let meta = #{
    name: "build-runtime-split",
    description: "Implement the jsvm3 compiler/runtime split (PRs 1-6) on a feature branch and verify",
    when_to_use: "When landing the build-vs-runtime split from docs/superpowers/specs/2026-08-16-build-runtime-split-design.md",
    phases: [
        #{ title: "PR1", detail: "artifact envelope + fromJson compat" },
        #{ title: "PR2", detail: "LabelHost + numeric Guard" },
        #{ title: "PR3", detail: "multi-entry rollup + exports" },
        #{ title: "PR4", detail: "compile / loadArtifact / run APIs" },
        #{ title: "PR5", detail: "jsvm3 CLI" },
        #{ title: "PR6", detail: "test matrix + docs" },
        #{ title: "Verify", detail: "full test suite on the branch" },
    ],
};

let result_schema = #{
    "type": "object",
    "required": ["ok", "summary"],
    "properties": #{
        "ok": #{ "type": "boolean" },
        "summary": #{ "type": "string" },
        "files": #{
            "type": "array",
            "items": #{ "type": "string" },
        },
    },
};

let repo = "/Users/ximing/project/mygithub/jsvm3";
let spec = repo + "/docs/superpowers/specs/2026-08-16-build-runtime-split-design.md";
let branch = "feat/build-runtime-split";
if args != () && args.branch != () && args.branch != "" {
    branch = args.branch;
}

fn failed(step, reason) {
    complete(#{
        ok: false,
        failed_at: step,
        summary: reason,
    });
}

fn agent_failed(step, r) {
    if r == () { return true; }
    if r.success != true { return true; }
    if r.output != () && r.output.ok == false { return true; }
    return false;
}

fn fail_reason(r) {
    if r == () { return "agent slot empty"; }
    if r.success != true { return "agent success=false"; }
    if r.output != () && r.output.summary != () { return r.output.summary; }
    return "unknown failure";
}

let common = "";
common += "You are implementing one PR of the jsvm3 build/runtime split in the existing repo.\n";
common += "Repo: " + repo + "\n";
common += "Design spec (READ THIS FIRST, it is the source of truth): " + spec + "\n";
common += "Work on git branch `" + branch + "` (create it from master if missing; never commit to master).\n";
common += "Rules:\n";
common += "- Read the spec section for YOUR PR and the Key Decisions before editing.\n";
common += "- Follow existing code style. Smallest change that satisfies the spec.\n";
common += "- Do not implement later PRs. Do not do the 2.0 optional-peer work.\n";
common += "- Do not set package-level sideEffects to false.\n";
common += "- Do not move Script out of src/vm/script.ts. Do not move fromJson/instructionsFromJson out of src/utils/convert.ts.\n";
common += "- Do not export compileToScript from the compiler public API.\n";
common += "- Run the tests named in your PR. If they fail, fix them before finishing.\n";
common += "- Commit on `" + branch + "` with the PR title as the subject.\n";
common += "- Return JSON {ok:true/false, summary, files} via the schema. ok=false if tests fail or you could not finish.\n";

phase("PR1");
log("PR1: versioned artifact envelope");
let p1 = "";
p1 += common;
p1 += "\n## Your PR: PR 1 — feat(artifact): versioned envelope wrapper around fromJson (1.3.0)\n";
p1 += "Read spec: PR Plan PR 1, KD-4, Data Model, Call contracts for loadArtifact/dumpArtifact, artifact types/errors.\n";
p1 += "Implement ALL of this:\n";
p1 += "1. Create src/artifact/version.ts, types.ts, errors.ts, index.ts. NO script.ts, NO load.ts.\n";
p1 += "   - ARTIFACT_MAGIC = 'JSVM3', ARTIFACT_FORMAT = 1, OPCODE_VERSION = 1.\n";
p1 += "   - Types: ScriptJson 10-tuple, Artifact envelope, ArtifactInput, CompileOptions, DumpableInstruction, DumpableScript.\n";
p1 += "   - Errors MUST extend Error (NOT JSVMError): ArtifactFormatError, ArtifactVersionError, ArtifactLoadError, CompileError.\n";
p1 += "2. src/utils/convert.ts: fromJson/loadArtifact accept a 10-tuple OR {magic:'JSVM3',...}.\n";
p1 += "   - 10-tuple path must preserve today's field semantics including json[10] source slot, 0->null, -1->null for guards.\n";
p1 += "   - Object without magic -> ArtifactFormatError (do not silently parse as array).\n";
p1 += "   - Bad format/opcode -> ArtifactVersionError with field/expected/actual.\n";
p1 += "   - dumpArtifact(script, {format}) default format 0 returns RAW ScriptJson array, NEVER an envelope.\n";
p1 += "   - dumpArtifact({format:1}) returns the envelope. fromJson stays in this file; loadArtifact is an alias.\n";
p1 += "3. src/index.ts and src/exp.ts: additionally export loadArtifact and the error classes. Keep JSVM + fromJson.\n";
p1 += "4. package.json name -> jsvm3. Do NOT change exports/main/dependencies/files.\n";
p1 += "5. Tests in __tests__/fromJson.test.ts (keep existing cases working) plus: envelope roundtrip, bad magic, bad opcode,\n";
p1 += "   regexp, try/catch guards, globalNames, 10-tuple without index 10.\n";
p1 += "6. Run: pnpm test __tests__/fromJson.test.ts __tests__/es5/binaryExpression.test.ts\n";
p1 += "   Existing helper tests must still pass because dump default is format 0 and fromJson still loads arrays.\n";
let r1 = agent(p1, #{
    label: "pr1-envelope",
    capability_mode: "all",
    output_schema: result_schema,
});
if agent_failed("pr1", r1) { failed("pr1", fail_reason(r1)); }

phase("PR2");
log("PR2: LabelHost + numeric Guard");
let p2 = "";
p2 += common;
p2 += "\n## Your PR: PR 2 — refactor: LabelHost and numeric Guard (1.3.0)\n";
p2 += "PR 1 is already committed on this branch. Build on it.\n";
p2 += "Read spec KD-3 and PR Plan PR 2.\n";
p2 += "Implement:\n";
p2 += "1. src/opcodes/label.ts: remove import of compiler Emitter. Label.emitter is LabelHost { readonly instructions: { readonly length: number } }.\n";
p2 += "2. Runtime Guard in src/vm/types.ts is numbers only (start/handler/finalizer/end: number | null). Move compile-time Label guards into compiler (CompileGuard) if Emitter still needs Labels.\n";
p2 += "3. src/vm/script.ts: import Guard UNCONDITIONALLY (today it is inside @ifdef COMPILER but guards is a runtime field).\n";
p2 += "4. Update emitter.ts so it still compiles (it already converts labels to ips in end()).\n";
p2 += "5. Add scripts/check-runtime-imports.mjs: walk imports from src/index.ts and fail if compiler/ or @babel/ is reachable. Wire it into package.json scripts if easy, or document the command.\n";
p2 += "6. Do NOT claim lib/*.d.ts no longer mentions Label. Do NOT change opcode semantics.\n";
p2 += "7. Run: pnpm test && node scripts/check-runtime-imports.mjs\n";
let r2 = agent(p2, #{
    label: "pr2-labelhost",
    capability_mode: "all",
    output_schema: result_schema,
});
if agent_failed("pr2", r2) { failed("pr2", fail_reason(r2)); }

phase("PR3");
log("PR3: multi-entry rollup");
let p3 = "";
p3 += common;
p3 += "\n## Your PR: PR 3 — build: split runtime/compiler/full rollup entries (1.4.0)\n";
p3 += "PRs 1-2 are on the branch. Read spec KD-1, KD-2, KD-7, Proposed Design / 构建与 exports, PR 3.\n";
p3 += "Implement:\n";
p3 += "1. Separate rollup entries producing dist/runtime.js, dist/compiler.js, dist/full.js, keep dist/index.js as runtime alias, keep dist/exp.js.\n";
p3 += "2. package.json exports for jsvm3, jsvm3/runtime, jsvm3/compiler, jsvm3/full, jsvm3/artifact, jsvm3/exp.\n";
p3 += "   types must point at a REAL file. Keep lib/ in files. Babel STAYS in dependencies.\n";
p3 += "3. NEVER set package-level \"sideEffects\": false. Use an explicit sideEffects array including opcode registration files.\n";
p3 += "4. Runtime entry must call registerOpcodes() or side-effect-import src/opcodes/ins.ts so InsMap is populated.\n";
p3 += "5. full.js must externalize jsvm3/runtime and jsvm3/compiler (no second JSVM copy).\n";
p3 += "6. Generate runtime .d.ts from the Rollup COMPILER:false preprocessed graph if practical; otherwise ship a hand-written or tsc dts that does not require consumers to import compiler.\n";
p3 += "7. CI/script checks: runtime bundle must not contain @babel or compiler/emitter; gzip of runtime <= 6KB (or document measured size if slightly over and keep it close to current 4.3KB gzip); scan that InsMap.set still exists for known opcodes after minify.\n";
p3 += "8. Run: pnpm build && pnpm test && the new checks.\n";
let r3 = agent(p3, #{
    label: "pr3-entries",
    capability_mode: "all",
    output_schema: result_schema,
});
if agent_failed("pr3", r3) { failed("pr3", fail_reason(r3)); }

phase("PR4");
log("PR4: public compile / run APIs");
let p4 = "";
p4 += common;
p4 += "\n## Your PR: PR 4 — feat: stable compile / loadArtifact / run APIs (1.4.0)\n";
p4 += "PRs 1-3 are on the branch. Read spec KD-5, Call contracts, API section, PR 4.\n";
p4 += "Implement:\n";
p4 += "1. compile(source, options) in compiler: transform + dumpArtifact. Defaults hoisting true, convertES5 true, format 0. Failures -> CompileError with cause. Do NOT export compileToScript. Keep transform/transformEXP (mark transform deprecated in JSDoc).\n";
p4 += "2. src/full/index.ts: run(source, options) and FullJSVM. run = compile -> new JSVM(host, options) -> exec(json) -> return module.exports. convertES5 default true. On fiber.suspended still return module.exports.\n";
p4 += "3. JSVM constructor (host?, options?: {timeout, maxDepth}). Copy timeout/maxDepth onto each Fiber. exec(input, timeout?):\n";
p4 += "   - string -> TypeError (runtime, not only types)\n";
p4 += "   - Artifact or array -> loadArtifact (always hydrate via InsMap)\n";
p4 += "   - Script -> run directly\n";
p4 += "   - suspended -> undefined (exec), errors/timeout still throw\n";
p4 += "4. Do NOT change __tests__/helper.ts defaults (convertES5 remains false; helper must NOT become public run).\n";
p4 += "5. Compiler statically imports Babel packages as FUNCTIONS into transformSync (not string plugin names) if you touch transform. Do not break existing tests.\n";
p4 += "6. Add a type test that exec('source') is @ts-expect-error.\n";
p4 += "7. Root 1.4 MAY re-export compile/run only if the root file does not statically import compiler/index.ts (would pull Babel into webpack from 'jsvm3'). Prefer subpath-only if cleaner.\n";
p4 += "8. Run: pnpm test && pnpm typecheck\n";
let r4 = agent(p4, #{
    label: "pr4-apis",
    capability_mode: "all",
    output_schema: result_schema,
});
if agent_failed("pr4", r4) { failed("pr4", fail_reason(r4)); }

phase("PR5");
log("PR5: CLI");
let p5 = "";
p5 += common;
p5 += "\n## Your PR: PR 5 — feat(cli): jsvm3 compile / run / eval (1.4.0)\n";
p5 += "PRs 1-4 are on the branch. Read spec CLI + PR 5.\n";
p5 += "Implement a single full CLI (package.json bin jsvm3 -> dist/cli.js). Commands:\n";
p5 += "- compile <in.js> -o <out.json>   default --format 0 (raw array). --format 1 writes envelope.\n";
p5 += "- run <in.js>   compile+execute, print module.exports (uses full, may need Babel).\n";
p5 += "- eval <expr>   expression path via transformEXP + exec, print rexp.\n";
p5 += "CLI is NOT part of the runtime bundle. Device path A does not use the CLI.\n";
p5 += "Tests: __tests__/cli.compile.test.ts covering format 0 output is a raw array loadable by fromJson, and format 1 envelope.\n";
p5 += "Run: pnpm test __tests__/cli.compile.test.ts && pnpm test\n";
let r5 = agent(p5, #{
    label: "pr5-cli",
    capability_mode: "all",
    output_schema: result_schema,
});
if agent_failed("pr5", r5) { failed("pr5", fail_reason(r5)); }

phase("PR6");
log("PR6: tests and docs");
let p6 = "";
p6 += common;
p6 += "\n## Your PR: PR 6 — test+docs: dual delivery paths and version matrix (1.4.0)\n";
p6 += "PRs 1-5 are on the branch. Read spec PR 6 + Security (not a sandbox) + rollout defaults.\n";
p6 += "Implement:\n";
p6 += "1. __tests__/runtime-only.test.ts: load pre-generated fixtures via loadArtifact + JSVM (no compiler import). Optionally stub @babel to throw if imported.\n";
p6 += "2. __tests__/full-run.test.ts: public run() returns module.exports.\n";
p6 += "3. A bundler fixture (webpack or a small rollup) that imports only jsvm3/runtime and executes a wide-opcode fixture. Skip gracefully if webpack is not a dependency, but prefer adding a tiny rollup-based fixture using the already-present rollup.\n";
p6 += "4. helper.ts may add optional JSVM_RUN_VIA_ARTIFACT env (default off) that JSON-roundtrips before exec. Default path unchanged.\n";
p6 += "5. Update readme.md: path A / path B, not a sandbox, sizes, CLI is full, 1.4 default format 0, package name jsvm3.\n";
p6 += "6. Do NOT move Babel out of dependencies.\n";
p6 += "7. Run: pnpm test && pnpm build\n";
let r6 = agent(p6, #{
    label: "pr6-docs-tests",
    capability_mode: "all",
    output_schema: result_schema,
});
if agent_failed("pr6", r6) { failed("pr6", fail_reason(r6)); }

phase("Verify");
log("Full verification");
let pv = "";
pv += "You are the final verifier for the jsvm3 build/runtime split.\n";
pv += "Repo: " + repo + "\n";
pv += "Branch must be `" + branch + "`. Spec: " + spec + "\n";
pv += "Use tools. Do not trust earlier agents. Independently:\n";
pv += "1. git log --oneline master.." + branch + " and git diff --stat master..." + branch + "\n";
pv += "2. Confirm package.json name is jsvm3, Babel still in dependencies, no package-level sideEffects false.\n";
pv += "3. Confirm fromJson/loadArtifact still live in src/utils/convert.ts and Script is still in src/vm/script.ts.\n";
pv += "4. Confirm src/opcodes/label.ts does not import compiler.\n";
pv += "5. Confirm compiler public API has compile() and does not export compileToScript.\n";
pv += "6. Run: pnpm test\n";
pv += "7. Run: pnpm build (if entries exist) and check runtime bundle has no @babel string.\n";
pv += "8. If you find blocking bugs, FIX them on `" + branch + "` and commit `fix: verifier repairs`.\n";
pv += "Return {ok, summary, files}. ok=true only if pnpm test passed after any fixes.\n";
let rv = agent(pv, #{
    label: "final-verify",
    capability_mode: "all",
    output_schema: result_schema,
});
if agent_failed("verify", rv) { failed("verify", fail_reason(rv)); }

let report = "";
report += "# build-runtime-split result\n\n";
report += "Branch: `" + branch + "`\n\n";
if r1.output != () { report += "- PR1: " + r1.output.summary + "\n"; }
if r2.output != () { report += "- PR2: " + r2.output.summary + "\n"; }
if r3.output != () { report += "- PR3: " + r3.output.summary + "\n"; }
if r4.output != () { report += "- PR4: " + r4.output.summary + "\n"; }
if r5.output != () { report += "- PR5: " + r5.output.summary + "\n"; }
if r6.output != () { report += "- PR6: " + r6.output.summary + "\n"; }
if rv.output != () { report += "- Verify: " + rv.output.summary + "\n"; }

let path = write_scratch_file("report.md", report);
complete(#{
    ok: true,
    branch: branch,
    report_path: path,
    summary: "Implemented PRs 1-6 of the build/runtime split and verified tests.",
});
