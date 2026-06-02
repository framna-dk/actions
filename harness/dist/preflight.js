import { createRequire as __WEBPACK_EXTERNAL_createRequire } from "module";
/******/ /* webpack/runtime/compat */
/******/ 
/******/ if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = new URL('.', import.meta.url).pathname.slice(import.meta.url.match(/^file:\/\/\/\w:/) ? 1 : 0, -1) + "/";
/******/ 
/************************************************************************/
var __webpack_exports__ = {};

;// CONCATENATED MODULE: external "node:child_process"
const external_node_child_process_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:child_process");
;// CONCATENATED MODULE: ./src/logging.ts
let configuredLevel = "info";
const order = { error: 0, warn: 1, info: 2, debug: 3 };
const secrets = new Set();
function setLogLevel(level) {
    if (level === "debug" || level === "info" || level === "warn" || level === "error") {
        configuredLevel = level;
    }
}
function registerSecret(value) {
    if (value && value.length >= 4)
        secrets.add(value);
}
function redact(s) {
    let out = s;
    for (const v of secrets) {
        out = out.split(v).join("[REDACTED]");
    }
    return out;
}
function emit(level, fields) {
    if (order[level] > order[configuredLevel])
        return;
    const payload = { at: new Date().toISOString(), level, ...fields };
    const line = redact(JSON.stringify(payload));
    if (level === "error")
        console.error(line);
    else if (level === "warn")
        console.warn(line);
    else
        console.log(line);
}
const log = {
    debug: (f) => emit("debug", f),
    info: (f) => emit("info", f),
    warn: (f) => emit("warn", f),
    error: (f) => emit("error", f),
};

;// CONCATENATED MODULE: ./src/preflight.ts


const REQUIRED_INPUTS = [
    "issue_id",
    "attempt",
    "tracker_kind",
    "tracker_project_id",
    "prompt_path",
];
const REQUIRED_BINS = ["node", "codex", "gh", "git", "jq", "bash"];
function probe(bin) {
    const r = (0,external_node_child_process_namespaceObject.spawnSync)(bin, ["--version"], { stdio: "ignore" });
    if (r.status === 0)
        return true;
    // Some binaries (bash) need -c true
    const r2 = (0,external_node_child_process_namespaceObject.spawnSync)(bin, ["-c", "true"], { stdio: "ignore" });
    return r2.status === 0;
}
function main() {
    const inputsRaw = process.env.HARNESS_INPUTS_JSON ?? "{}";
    let inputs;
    try {
        inputs = JSON.parse(inputsRaw);
    }
    catch (e) {
        log.error({ module: "preflight", event: "bad_inputs_json", message: String(e.message) });
        return 1;
    }
    setLogLevel(inputs.log_level ?? "info");
    const missingInputs = REQUIRED_INPUTS.filter((k) => !inputs[k]);
    if (missingInputs.length > 0) {
        log.error({
            module: "preflight",
            event: "missing_inputs",
            message: missingInputs.join(", "),
        });
        return 1;
    }
    if (inputs.tracker_kind !== "github_projects_v2") {
        log.error({
            module: "preflight",
            event: "unsupported_tracker_kind",
            message: String(inputs.tracker_kind),
        });
        return 1;
    }
    const missingBins = REQUIRED_BINS.filter((b) => !probe(b));
    if (missingBins.length > 0) {
        log.error({
            module: "preflight",
            event: "missing_binaries",
            message: missingBins.join(", "),
        });
        return 1;
    }
    if (!process.env.GH_TOKEN) {
        log.error({ module: "preflight", event: "missing_credentials", message: "GH_TOKEN env unset" });
        return 1;
    }
    log.info({
        module: "preflight",
        event: "ok",
        issue_id: inputs.issue_id,
        message: `attempt=${inputs.attempt} project=${inputs.tracker_project_id}`,
    });
    return 0;
}
process.exit(main());

