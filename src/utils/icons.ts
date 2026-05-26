import { Plugin } from "siyuan";

/**
 * Local icon registry.
 *
 * Inspired by `sy-bookmark-plus` (frostime/sy-bookmark-plus):
 *   - Plugin-bundled SVGs are written as raw `<symbol id="...">...</symbol>` strings.
 *   - They are injected into the host document once via `plugin.addIcons(...)`
 *     during `onload`, so they sit in the same global `<svg>` defs as SiYuan's
 *     built-in symbols.
 *   - The icon picker enumerates `document.querySelectorAll('symbol')` so the
 *     same pipeline naturally unifies "plugin icons" and "SiYuan host icons".
 *   - Settings only stores a lightweight reference (e.g. `symbol:iconCalloutInfo`),
 *     never the full SVG payload.
 */

// -- Icon reference encoding ------------------------------------------------

export type IconRef =
    | { kind: "empty" }
    | { kind: "symbol"; id: string }
    | { kind: "url"; value: string }
    | { kind: "keyword"; value: string };

export const SYMBOL_PREFIX = "symbol:";

export function parseIconRef(value: string | null | undefined): IconRef {
    const raw = (value || "").trim();
    if (!raw) return { kind: "empty" };
    if (raw.startsWith(SYMBOL_PREFIX)) {
        const id = raw.slice(SYMBOL_PREFIX.length).trim();
        return id ? { kind: "symbol", id } : { kind: "empty" };
    }
    if (raw.startsWith("url(") || raw.startsWith("data:image/svg+xml")) {
        return { kind: "url", value: raw };
    }
    return { kind: "keyword", value: raw };
}

export function stringifyIconRef(ref: IconRef): string {
    switch (ref.kind) {
        case "empty":
            return "";
        case "symbol":
            return `${SYMBOL_PREFIX}${ref.id}`;
        case "url":
            return ref.value;
        case "keyword":
            return ref.value;
    }
}

// -- Plugin-bundled <symbol> definitions ------------------------------------

function makeLucideSymbol(id: string, paths: string) {
    return `<symbol id="${id}" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</g></symbol>`;
}

export const PLUGIN_SVG_SYMBOLS: Record<string, string> = {
    iconCalloutInfo: makeLucideSymbol(
        "iconCalloutInfo",
        "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16v-4\"/><path d=\"M12 8h.01\"/>",
    ),
    iconCalloutNote: makeLucideSymbol(
        "iconCalloutNote",
        "<path d=\"M12 20h9\"/><path d=\"M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z\"/>",
    ),
    iconCalloutImportant: makeLucideSymbol(
        "iconCalloutImportant",
        "<path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\"/><path d=\"M12 8v4\"/><path d=\"M12 16h.01\"/>",
    ),
    iconCalloutQuote: makeLucideSymbol(
        "iconCalloutQuote",
        "<path d=\"M3 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2H4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2h2c0 2-1 3-3 3\"/><path d=\"M15 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2h-4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2h2c0 2-1 3-3 3\"/>",
    ),
    iconCalloutTip: makeLucideSymbol(
        "iconCalloutTip",
        "<path d=\"M15 14c.2-1 .7-1.7 1.5-2.5A4.9 4.9 0 0 0 18 8 6 6 0 0 0 6 8c0 1.3.4 2.5 1.5 3.5.7.7 1.3 1.5 1.5 2.5\"/><path d=\"M9 18h6\"/><path d=\"M10 22h4\"/>",
    ),
    iconCalloutWarning: makeLucideSymbol(
        "iconCalloutWarning",
        "<path d=\"m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/>",
    ),
    iconCalloutCaution: makeLucideSymbol(
        "iconCalloutCaution",
        "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 8v4\"/><path d=\"M12 16h.01\"/>",
    ),
    iconCalloutQuestion: makeLucideSymbol(
        "iconCalloutQuestion",
        "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3\"/><path d=\"M12 17h.01\"/>",
    ),
    iconCalloutBookmark: makeLucideSymbol(
        "iconCalloutBookmark",
        "<path d=\"m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z\"/>",
    ),
    iconCalloutStar: makeLucideSymbol(
        "iconCalloutStar",
        "<polygon points=\"12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2\"/>",
    ),
    iconCalloutHeart: makeLucideSymbol(
        "iconCalloutHeart",
        "<path d=\"M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z\"/>",
    ),
    iconCalloutBook: makeLucideSymbol(
        "iconCalloutBook",
        "<path d=\"M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20\"/>",
    ),
    iconCalloutLightbulb: makeLucideSymbol(
        "iconCalloutLightbulb",
        "<path d=\"M9 18h6\"/><path d=\"M10 22h4\"/><path d=\"M15.09 14A4 4 0 0 0 18 10a6 6 0 0 0-12 0 4 4 0 0 0 2.91 4\"/>",
    ),
    iconCalloutFire: makeLucideSymbol(
        "iconCalloutFire",
        "<path d=\"M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z\"/>",
    ),
    iconCalloutFlag: makeLucideSymbol(
        "iconCalloutFlag",
        "<path d=\"M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z\"/><line x1=\"4\" x2=\"4\" y1=\"22\" y2=\"15\"/>",
    ),
    iconCalloutCheckCircle: makeLucideSymbol(
        "iconCalloutCheckCircle",
        "<path d=\"M22 11.08V12a10 10 0 1 1-5.93-9.14\"/><polyline points=\"22 4 12 14.01 9 11.01\"/>",
    ),
    iconCalloutXCircle: makeLucideSymbol(
        "iconCalloutXCircle",
        "<circle cx=\"12\" cy=\"12\" r=\"10\"/><line x1=\"15\" x2=\"9\" y1=\"9\" y2=\"15\"/><line x1=\"9\" x2=\"15\" y1=\"9\" y2=\"15\"/>",
    ),
    iconCalloutPin: makeLucideSymbol(
        "iconCalloutPin",
        "<line x1=\"12\" x2=\"12\" y1=\"17\" y2=\"22\"/><path d=\"M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z\"/>",
    ),
    iconCalloutBug: makeLucideSymbol(
        "iconCalloutBug",
        "<path d=\"m8 2 1.88 1.88\"/><path d=\"M14.12 3.88 16 2\"/><path d=\"M9 7.13v-1a3 3 0 0 1 6 0v1\"/><path d=\"M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6\"/><path d=\"M12 20v-9\"/><path d=\"M6.53 9C4.6 8.8 3 7.1 3 5\"/><path d=\"M6 13H2\"/><path d=\"M3 21c0-2.1 1.7-3.9 3.8-4\"/><path d=\"M20.97 5c0 2.1-1.6 3.8-3.5 4\"/><path d=\"M22 13h-4\"/><path d=\"M17.2 17c2.1.1 3.8 1.9 3.8 4\"/>",
    ),
    iconCalloutCode: makeLucideSymbol(
        "iconCalloutCode",
        "<polyline points=\"16 18 22 12 16 6\"/><polyline points=\"8 6 2 12 8 18\"/>",
    ),
    iconCalloutLink: makeLucideSymbol(
        "iconCalloutLink",
        "<path d=\"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\"/><path d=\"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\"/>",
    ),
    iconCalloutTarget: makeLucideSymbol(
        "iconCalloutTarget",
        "<circle cx=\"12\" cy=\"12\" r=\"10\"/><circle cx=\"12\" cy=\"12\" r=\"6\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/>",
    ),
    iconCalloutCalendar: makeLucideSymbol(
        "iconCalloutCalendar",
        "<rect width=\"18\" height=\"18\" x=\"3\" y=\"4\" rx=\"2\" ry=\"2\"/><line x1=\"16\" x2=\"16\" y1=\"2\" y2=\"6\"/><line x1=\"8\" x2=\"8\" y1=\"2\" y2=\"6\"/><line x1=\"3\" x2=\"21\" y1=\"10\" y2=\"10\"/>",
    ),
};

// Friendly metadata for plugin-bundled icons (search keywords beyond the id).
const PLUGIN_SYMBOL_META: Record<string, { label: string; keywords?: string[] }> = {
    iconCalloutInfo: { label: "Info", keywords: ["info", "information", "提示", "信息"] },
    iconCalloutNote: { label: "Note", keywords: ["note", "edit", "笔记", "便签"] },
    iconCalloutImportant: { label: "Important", keywords: ["important", "重要", "标记"] },
    iconCalloutQuote: { label: "Quote", keywords: ["quote", "quotation", "引用"] },
    iconCalloutTip: { label: "Tip", keywords: ["tip", "hint", "提示", "灯泡"] },
    iconCalloutWarning: { label: "Warning", keywords: ["warning", "警告"] },
    iconCalloutCaution: { label: "Caution", keywords: ["caution", "danger", "危险", "注意"] },
    iconCalloutQuestion: { label: "Question", keywords: ["question", "help", "问题", "疑问"] },
    iconCalloutBookmark: { label: "Bookmark", keywords: ["bookmark", "书签"] },
    iconCalloutStar: { label: "Star", keywords: ["star", "favourite", "favorite", "星标"] },
    iconCalloutHeart: { label: "Heart", keywords: ["heart", "like", "喜欢"] },
    iconCalloutBook: { label: "Book", keywords: ["book", "read", "书"] },
    iconCalloutLightbulb: { label: "Lightbulb", keywords: ["lightbulb", "idea", "灵感"] },
    iconCalloutFire: { label: "Fire", keywords: ["fire", "热门", "hot"] },
    iconCalloutFlag: { label: "Flag", keywords: ["flag", "标记"] },
    iconCalloutCheckCircle: { label: "Check", keywords: ["check", "success", "ok", "完成"] },
    iconCalloutXCircle: { label: "Error", keywords: ["error", "fail", "x", "错误"] },
    iconCalloutPin: { label: "Pin", keywords: ["pin", "钉", "固定"] },
    iconCalloutBug: { label: "Bug", keywords: ["bug", "缺陷"] },
    iconCalloutCode: { label: "Code", keywords: ["code", "代码"] },
    iconCalloutLink: { label: "Link", keywords: ["link", "链接"] },
    iconCalloutTarget: { label: "Target", keywords: ["target", "目标"] },
    iconCalloutCalendar: { label: "Calendar", keywords: ["calendar", "日期", "日历"] },
};

// -- Registration ----------------------------------------------------------

let registered = false;

/**
 * Register all plugin-bundled SVG symbols into the SiYuan host. Idempotent.
 */
export function registerPluginIcons(plugin: Plugin) {
    if (registered) return;
    const keys = Object.keys(PLUGIN_SVG_SYMBOLS);
    let joined = "";
    for (let i = 0; i < keys.length; i++) {
        joined += PLUGIN_SVG_SYMBOLS[keys[i]];
    }
    if (!joined) {
        registered = true;
        return;
    }
    // `addIcons` is exposed by the SiYuan Plugin base class.
    (plugin as unknown as { addIcons?: (svg: string) => void }).addIcons?.(joined);
    registered = true;
}

export function isPluginSymbol(id: string) {
    return Object.prototype.hasOwnProperty.call(PLUGIN_SVG_SYMBOLS, id);
}

// -- Discovery & search ----------------------------------------------------

export type SymbolEntry = {
    id: string;
    source: "plugin" | "host";
    label: string;
    keywords: string[];
};

function humanizeId(id: string) {
    const stripped = id.replace(/^icon/i, "");
    const spaced = stripped.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
    return spaced.replace(/[_-]+/g, " ").trim() || id;
}

export function listAllSymbolEntries(): SymbolEntry[] {
    const seen = new Set<string>();
    const entries: SymbolEntry[] = [];
    if (typeof document === "undefined") return entries;
    // Use the same broad selector as sy-bookmark-plus -- match every `<symbol>`
    // in the document regardless of namespace nesting (e.g. inside <defs>).
    document.querySelectorAll<SVGSymbolElement>("symbol").forEach((sym) => {
        const id = sym.id;
        // Symbols without an id cannot be referenced via <use href="#...">,
        // so they are not useful to expose in the picker.
        if (!id) return;
        // Dedup by id: SiYuan occasionally registers multiple sprites whose
        // symbol ids collide (e.g. fallback material set + user-selected
        // theme). Only the first one would actually paint via <use>.
        if (seen.has(id)) return;
        seen.add(id);
        const isPlugin = isPluginSymbol(id);
        const meta = PLUGIN_SYMBOL_META[id];
        entries.push({
            id,
            source: isPlugin ? "plugin" : "host",
            label: meta?.label || humanizeId(id),
            keywords: meta?.keywords ? [...meta.keywords] : [],
        });
    });
    // Plugin icons first (stable order matching PLUGIN_SVG_SYMBOLS keys),
    // then host icons alphabetically by id.
    const pluginOrder = Object.keys(PLUGIN_SVG_SYMBOLS);
    entries.sort((a, b) => {
        if (a.source !== b.source) return a.source === "plugin" ? -1 : 1;
        if (a.source === "plugin") {
            return pluginOrder.indexOf(a.id) - pluginOrder.indexOf(b.id);
        }
        return a.id.localeCompare(b.id);
    });
    return entries;
}

export function searchSymbolEntries(entries: SymbolEntry[], query: string): SymbolEntry[] {
    const q = (query || "").trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((entry) => {
        if (entry.id.toLowerCase().includes(q)) return true;
        if (entry.label.toLowerCase().includes(q)) return true;
        return entry.keywords.some((k) => k.toLowerCase().includes(q));
    });
}

// -- Rendering -------------------------------------------------------------

export function hasSymbol(id: string) {
    if (!id || typeof document === "undefined") return false;
    return !!getSymbolElement(id);
}

/**
 * Convert a registered `<symbol>` into a CSS-mask-friendly `url(...)` data URL.
 * Returns `null` when the symbol is missing so callers can fall back gracefully.
 */
export function symbolToMaskUrl(id: string): string | null {
    if (!id || typeof document === "undefined") return null;
    const el = getSymbolElement(id);
    if (!el) return null;
    const viewBox = el.getAttribute("viewBox") || "0 0 24 24";
    // `currentColor` is not resolvable inside a standalone data URL, so swap
    // it to black -- only the alpha channel matters when used as a mask.
    const inner = (el as unknown as SVGSymbolElement).innerHTML.replace(/currentColor/g, "black");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${inner}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export type SymbolRenderMeta = {
    source: "plugin" | "host";
    /** Lucide-style outline icons use stroke; SiYuan material icons use fill. */
    paint: "fill" | "stroke";
};

/**
 * Decide how a symbol should be painted when referenced through `<use>`.
 *
 * Plugin icons are Lucide outlines (`fill="none" stroke-width="2"`). SiYuan
 * host icons are mostly Material-style filled paths. Applying both
 * `fill:currentColor` and `stroke:currentColor` on the outer `<svg>` makes
 * host icons look artificially bold/thick.
 */
export function getSymbolRenderMeta(id: string): SymbolRenderMeta {
    if (isPluginSymbol(id)) {
        return { source: "plugin", paint: "stroke" };
    }
    const sym = getSymbolElement(id);
    if (!sym) {
        return { source: "host", paint: "fill" };
    }
    const hasStroke = !!sym.querySelector("[stroke]:not([stroke='none'])");
    const hasFill = !!sym.querySelector("[fill]:not([fill='none'])");
    if (hasStroke && !hasFill) {
        return { source: "host", paint: "stroke" };
    }
    return { source: "host", paint: "fill" };
}

function symbolPaintStyle(meta: SymbolRenderMeta) {
    if (meta.paint === "stroke") {
        return "fill:none;stroke:currentColor;";
    }
    return "fill:currentColor;stroke:none;";
}

/**
 * Build the HTML for an inline `<svg><use href="#id"/></svg>` icon.
 * Inherits color from `currentColor` and sizes to the requested size.
 */
export function renderSymbolUseHtml(id: string, size = "20px", extraClass = "") {
    const meta = getSymbolRenderMeta(id);
    const cls = [
        "callout-enhance-symbol-icon",
        `callout-enhance-symbol-icon--${meta.source}`,
        `callout-enhance-symbol-icon--${meta.paint}`,
        extraClass,
    ].filter(Boolean).join(" ");
    // SiYuan and sy-bookmark-plus both render sprite icons by writing an HTML
    // string with `<use xlink:href="#id">`. The HTML parser then handles the
    // SVG/xlink namespaces automatically. `viewBox` is intentionally omitted:
    // when missing on `<svg>`, browsers inherit it from the referenced
    // `<symbol>`, which is exactly the behavior we want.
    return `<svg class="${cls}" style="width:${size};height:${size};color:inherit;${symbolPaintStyle(meta)}pointer-events:none;"><use xlink:href="#${id}" href="#${id}"></use></svg>`;
}

export function createSymbolUseElement(id: string, size = "20px", extraClass = ""): SVGSVGElement {
    const svgNs = "http://www.w3.org/2000/svg";
    const xlinkNs = "http://www.w3.org/1999/xlink";
    const svg = document.createElementNS(svgNs, "svg");
    const cls = ["callout-enhance-symbol-icon", extraClass].filter(Boolean).join(" ");
    svg.setAttribute("class", cls);
    svg.setAttribute("viewBox", getSymbolViewBox(id));
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.style.width = size;
    svg.style.height = size;
    svg.style.color = "inherit";
    svg.style.fill = "currentColor";
    svg.style.stroke = "currentColor";
    const use = document.createElementNS(svgNs, "use");
    use.setAttribute("href", `#${id}`);
    use.setAttribute("xlink:href", `#${id}`);
    use.setAttributeNS(xlinkNs, "href", `#${id}`);
    use.setAttribute("width", "100%");
    use.setAttribute("height", "100%");
    use.style.color = "inherit";
    use.style.fill = "currentColor";
    use.style.stroke = "currentColor";
    svg.appendChild(use);
    return svg;
}

/**
 * Render a symbol preview by cloning the symbol body into a standalone SVG.
 *
 * The icon picker needs this stricter path because some SiYuan/Electron builds
 * can enumerate host `<symbol>` nodes correctly while still failing to paint
 * `<use href="#...">` inside dialog content. Cloning the symbol body avoids
 * that runtime indirection and mirrors the final icon shape exactly.
 */
export function createSymbolPreviewElement(id: string, size = "20px", extraClass = ""): SVGSVGElement {
    const svgNs = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNs, "svg");
    const cls = ["callout-enhance-symbol-icon", extraClass].filter(Boolean).join(" ");
    svg.setAttribute("class", cls);
    svg.setAttribute("viewBox", getSymbolViewBox(id));
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.style.width = size;
    svg.style.height = size;
    svg.style.color = "inherit";
    svg.style.fill = "currentColor";
    svg.style.stroke = "currentColor";

    const symbol = getSymbolElement(id);
    if (!symbol) return svg;

    Array.from(symbol.childNodes).forEach((node) => {
        svg.appendChild(node.cloneNode(true));
    });
    return svg;
}

function getSymbolElement(id: string): SVGSymbolElement | null {
    if (typeof document === "undefined" || !id) return null;
    const el = document.getElementById(id);
    if (!el || el.tagName.toLowerCase() !== "symbol") return null;
    return el as unknown as SVGSymbolElement;
}

function getSymbolViewBox(id: string) {
    const symbol = getSymbolElement(id);
    if (symbol) {
        const viewBox = symbol.getAttribute("viewBox");
        if (viewBox) return viewBox;
    }
    // SiYuan's built-in icon sprite commonly uses 32x32; bundled plugin icons
    // declare their own 24x24 viewBox, so this fallback mainly protects host
    // symbols that do not expose one.
    return "0 0 32 32";
}
