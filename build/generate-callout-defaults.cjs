const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const ENTRY = path.join(ROOT, "generate-callout-defaults-entry.ts");
const RUN_FILE = path.join(ROOT, ".generate-callout-defaults-run.cjs");
const SOURCE_FILES = [
    ENTRY,
    path.join(ROOT, "../src/utils/callout_dynamic_styles.ts"),
    path.join(ROOT, "../src/utils/callout_types.ts"),
    path.join(ROOT, "../src/utils/settings.ts"),
    path.join(ROOT, "../src/utils/callout_layout_vars.ts"),
    path.join(ROOT, "../src/utils/settings_schema_migration.ts"),
    path.join(ROOT, "../src/utils/callout_resolver.ts"),
    path.join(ROOT, "../src/utils/icons.ts"),
];

function getLatestMtime(files) {
    return files.reduce((latest, file) => {
        if (!fs.existsSync(file)) return latest;
        return Math.max(latest, fs.statSync(file).mtimeMs);
    }, 0);
}

function needsRebuildRunFile() {
    if (!fs.existsSync(RUN_FILE)) return true;
    const runMtime = fs.statSync(RUN_FILE).mtimeMs;
    return getLatestMtime(SOURCE_FILES) > runMtime;
}

async function rebuildRunFile() {
    let esbuild;
    try {
        esbuild = require("esbuild");
    } catch {
        throw new Error(
            "esbuild is required to generate callout_defaults.css. Run: pnpm add -D esbuild",
        );
    }

    await esbuild.build({
        entryPoints: [ENTRY],
        bundle: true,
        platform: "node",
        format: "cjs",
        target: "node16",
        outfile: RUN_FILE,
        logLevel: "silent",
    });
}

async function generate() {
    if (needsRebuildRunFile()) {
        await rebuildRunFile();
    }
    delete require.cache[require.resolve(RUN_FILE)];
    require(RUN_FILE);
}

module.exports = { generate };

if (require.main === module) {
    generate().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
