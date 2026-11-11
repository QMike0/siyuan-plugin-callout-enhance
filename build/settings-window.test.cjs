const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const { buildSync } = require("esbuild");

// Exercise the real plugin and style builders, isolating only SiYuan/DOM services.
const root = path.resolve(__dirname, "..");
const code = buildSync({
    entryPoints: [path.join(root, "src/index.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    external: ["siyuan"],
    loader: { ".scss": "empty" },
    write: false,
}).outputFiles[0].text;
const dynamicId = "callout-enhance-dynamic-styles";
const exportId = "snippetCSSCalloutEnhance";
const startupFlag = "__calloutEnhancePluginInitialized";
const customSettings = {
    schemaVersion: 6,
    callouts: [{ id: "custom", label: "CUSTOM", keywords: ["Custom"],
        pastLabels: ["OLD"], color: "#123456", icon: "NOTE", enabled: true, order: 0 }],
    layout: { "--callout-shell-padding-left": "21px" },
};

function createHost({ settingsWindow = false, publish = false, saved = customSettings, load } = {}) {
    const nodes = new Map();
    const timers = new Map();
    const frames = new Map();
    const observers = [];
    const writes = [];
    let serial = 0;
    let styleWrites = 0;
    const eventTarget = () => {
        const listeners = new Map();
        return {
            listeners,
            addEventListener(type, fn) {
                if (!listeners.has(type)) listeners.set(type, new Set());
                listeners.get(type).add(fn);
            },
            removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
        };
    };
    const classes = new Set(settingsWindow ? ["body--settings"] : []);
    const body = Object.assign(eventTarget(), {
        classList: {
            contains: (name) => classes.has(name),
            add: (name) => classes.add(name),
            remove: (name) => classes.delete(name),
        },
    });
    const head = { appendChild(node) { nodes.set(node.id, node); } };
    const document = Object.assign(eventTarget(), {
        body, head,
        getElementById: (id) => nodes.get(id) || null,
        querySelectorAll: () => [],
        createElement(tag) {
            assert.equal(tag, "style", "Unexpected DOM creation in lifecycle");
            let content = "";
            return {
                tagName: "STYLE", id: "",
                get textContent() { return content; },
                set textContent(value) { content = value; styleWrites++; },
                remove() { nodes.delete(this.id); },
            };
        },
    });
    const eventBus = {
        ...eventTarget(),
        on(type, fn) { this.addEventListener(type, fn); },
        off(type, fn) { this.removeEventListener(type, fn); },
    };
    const window = {
        siyuan: { isPublish: publish, config: { appearance: { icon: "old", iconVer: "1" } } },
        setTimeout(fn) { const id = ++serial; timers.set(id, fn); return id; },
    };
    class Plugin {
        constructor() { this.i18n = {}; this.data = {}; this.eventBus = eventBus; }
        addIcons() {}
        loadData() { return load ? load() : Promise.resolve(saved); }
        async saveData(name, data) { writes.push({ name, data }); }
    }
    class MutationObserver {
        constructor(callback) { this.callback = callback; this.connected = false; observers.push(this); }
        observe(target, options) { this.target = target; this.options = options; this.connected = true; }
        disconnect() { this.connected = false; }
    }
    const module = { exports: {} };
    vm.runInNewContext(code, {
        module, exports: module.exports, document, window, MutationObserver,
        Node: { ELEMENT_NODE: 1 }, console, AbortController,
        setTimeout: window.setTimeout, clearTimeout: (id) => timers.delete(id),
        requestAnimationFrame(fn) { const id = ++serial; frames.set(id, fn); return id; },
        cancelAnimationFrame: (id) => frames.delete(id),
        require(name) { assert.equal(name, "siyuan"); return { Plugin }; },
    });
    const PluginClass = module.exports.default;
    const listenerCount = (target) => [...target.listeners.values()].reduce((n, set) => n + set.size, 0);
    return {
        plugin: new PluginClass(), nodes, timers, frames, observers, writes, window, body,
        eventBus, document, PluginClass,
        styleWrites: () => styleWrites,
        editorListenerCount: () => listenerCount(document) + listenerCount(body),
        busListenerCount: () => listenerCount(eventBus),
        flushTimers() {
            for (let round = 0; timers.size; round++) {
                assert.ok(round < 10, "Timers must settle without polling");
                const pending = [...timers.values()];
                timers.clear();
                pending.forEach((fn) => fn());
            }
        },
    };
}

test("manifest opts in without raising the existing minimum version", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "plugin.json"), "utf8"));
    assert.equal(manifest.settingsWindow, true);
    assert.equal(manifest.minAppVersion, "3.8.2");
});

test("native settings apply custom appearance without editor handlers or a body observer", async () => {
    const h = createHost({ settingsWindow: true });
    await h.plugin.onload();
    h.plugin.onLayoutReady();
    const css = h.nodes.get(dynamicId).textContent;
    assert.match(css, /#configBazaarReadme \.item__readme \.callout\[data-subtype="CUSTOM" i\]\{--local-color:#123456/);
    assert.match(css, /data-subtype="OLD" i/);
    assert.match(css, /--callout-shell-padding-left:21px/);
    assert.equal(h.nodes.has(exportId), false);
    assert.equal(h.editorListenerCount(), 0);
    assert.equal(h.observers.filter((o) => o.target === h.body).length, 0);
    assert.equal(h.busListenerCount(), 1);
    assert.equal(h.writes.length, 0);
    await h.plugin.onunload();
    assert.equal(h.nodes.size, 0);
    assert.equal(h.timers.size + h.frames.size + h.busListenerCount(), 0);
    assert.equal(h.window.__calloutEnhancePlugin, undefined);
    assert.ok(h.observers.every((o) => !o.connected));
});

test("settings window migrates old data in memory without writing it back", async () => {
    const h = createHost({ settingsWindow: true, saved: { schemaVersion: 2,
        callouts: [{ label: "CUSTOM", keyword: "Custom", color: "#123456" }] } });
    await h.plugin.onload();
    assert.equal(h.plugin.settings.schemaVersion, 6);
    assert.equal(h.writes.length, 0);
    await h.plugin.onunload();
});

test("main-window listeners, export styles and migration persistence remain enabled", async () => {
    const h = createHost({ saved: { schemaVersion: 2 } });
    await h.plugin.onload();
    h.plugin.onLayoutReady();
    assert.ok(h.editorListenerCount() > 1);
    assert.equal(h.observers.filter((o) => o.target === h.body && o.connected).length, 1);
    assert.equal(h.nodes.get(exportId).textContent, h.nodes.get(dynamicId).textContent);
    assert.equal(h.writes.length, 1);
    await h.plugin.onunload();
    assert.equal(h.editorListenerCount(), 0);
    assert.equal(h.nodes.size, 0);
});

test("publish service keeps its click guard and export styles", async () => {
    const h = createHost({ publish: true });
    await h.plugin.onload();
    assert.ok(h.body.classList.contains("callout-enhance-publish-service"));
    assert.equal(h.editorListenerCount(), 1);
    assert.ok(h.nodes.has(exportId));
    await h.plugin.onunload();
    assert.equal(h.editorListenerCount(), 0);
    assert.equal(h.body.classList.contains("callout-enhance-publish-service"), false);
});

test("icon appearance updates rebake settings styles and all timers settle", async () => {
    const h = createHost({ settingsWindow: true });
    await h.plugin.onload();
    h.flushTimers();
    const before = h.styleWrites();
    for (const handler of h.eventBus.listeners.get("ws-main")) {
        handler({ detail: { cmd: "setAppearance", data: { icon: "new", iconVer: "2" } } });
    }
    h.flushTimers();
    assert.ok(h.styleWrites() > before);
    await h.plugin.onunload();
    assert.equal(h.timers.size, 0);
});

test("closing during loadData cannot recreate styles, listeners or the startup flag", async () => {
    let resolve;
    const h = createHost({ settingsWindow: true, load: () => new Promise((done) => { resolve = done; }) });
    const loading = h.plugin.onload();
    await h.plugin.onunload();
    resolve(customSettings);
    await loading;
    h.plugin.onLayoutReady();
    assert.equal(h.nodes.size + h.timers.size + h.frames.size, 0);
    assert.equal(h.editorListenerCount() + h.busListenerCount(), 0);
    assert.equal(h.window[startupFlag], undefined);
    assert.equal(h.window.__calloutEnhancePlugin, undefined);
    assert.equal(h.writes.length, 0);
});

test("late paint after unload cannot overwrite a replacement instance's styles", async () => {
    const h = createHost({ settingsWindow: true });
    await h.plugin.onload();
    const latePaint = [...h.frames.values()][0];
    await h.plugin.onunload();
    const replacement = new h.PluginClass();
    await replacement.onload();
    await replacement.setSettings({ layout: { "--callout-shell-padding-left": "33px" } });
    const css = h.nodes.get(dynamicId).textContent;
    latePaint();
    assert.equal(h.nodes.get(dynamicId).textContent, css);
    assert.match(css, /--callout-shell-padding-left:33px/);
    await replacement.onunload();
});

test("main and settings instances keep independent styles and cleanup", async () => {
    const main = createHost();
    const settings = createHost({ settingsWindow: true });
    await Promise.all([main.plugin.onload(), settings.plugin.onload()]);
    const mainCss = main.nodes.get(dynamicId).textContent;
    await settings.plugin.onunload();
    assert.equal(main.nodes.get(dynamicId).textContent, mainCss);
    assert.equal(main.window[startupFlag], true);
    assert.ok(main.editorListenerCount() > 1);
    await main.plugin.onunload();
});
