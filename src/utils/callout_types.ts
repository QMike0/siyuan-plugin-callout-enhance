import { hasSymbol, parseIconRef, renderSymbolUseHtml, SYMBOL_PREFIX, symbolToMaskUrl } from "./icons";

export type CalloutTypeItem = {
    id: string;
    /** Unique callout tag written to `[!LABEL]` and `data-subtype`. */
    label: string;
    /** Search / completion aliases only; matching uses label + keywords, not callout title. */
    keywords: string[];
    /** Past labels after rename; used for style resolution and settings search, not completion. */
    historicalLabels: string[];
    icon: string;
    color: string;
    order: number;
    enabled: boolean;
};

/** Case-insensitive key for label / historical / tombstone occupancy. */
export function canonicalCalloutKey(value: string) {
    return normalizeCalloutLabel(value).toUpperCase();
}

export function equalsCalloutKeyCI(a: string, b: string) {
    const left = canonicalCalloutKey(a);
    const right = canonicalCalloutKey(b);
    return !!left && left === right;
}

/** Deduplicate by canonical key; keeps first occurrence casing. */
export function dedupeCalloutKeysCI(values: string[]) {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const raw of values) {
        const trimmed = normalizeCalloutLabel(raw);
        if (!trimmed) continue;
        const key = canonicalCalloutKey(trimmed);
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(trimmed);
    }
    return result;
}

export function appendHistoricalLabel(list: string[], label: string) {
    const trimmed = normalizeCalloutLabel(label);
    if (!trimmed) return [...list];
    return dedupeCalloutKeysCI([...list, trimmed]);
}

export function removeHistoricalLabelCI(list: string[], label: string) {
    const key = canonicalCalloutKey(label);
    if (!key) return [...list];
    return list.filter((item) => canonicalCalloutKey(item) !== key);
}

export function normalizeHistoricalLabels(raw: string[] | undefined, currentLabel = "") {
    const deduped = dedupeCalloutKeysCI(Array.isArray(raw) ? raw : []);
    const labelKey = canonicalCalloutKey(currentLabel);
    if (!labelKey) return deduped;
    return deduped.filter((item) => canonicalCalloutKey(item) !== labelKey);
}

/** Subtypes that share one type's dynamic CSS (label + historical); order: label first. */
export function getCalloutStyleSubtypes(item: Pick<CalloutTypeItem, "label" | "historicalLabels">) {
    const seen = new Set<string>();
    const subtypes: string[] = [];
    const add = (value: string) => {
        const trimmed = normalizeCalloutLabel(value);
        if (!trimmed) return;
        const key = canonicalCalloutKey(trimmed);
        if (seen.has(key)) return;
        seen.add(key);
        subtypes.push(trimmed);
    };
    add(item.label);
    for (const historical of item.historicalLabels || []) add(historical);
    return subtypes;
}

function svgMask(paths: string) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export const CALLOUT_ICON_MASKS: Record<string, string> = {
    INFO: svgMask("<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16v-4\"/><path d=\"M12 8h.01\"/>"),
    NOTE: svgMask("<path d=\"M12 20h9\"/><path d=\"M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z\"/>"),
    IMPORTANT: svgMask("<path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\"/><path d=\"M12 8v4\"/><path d=\"M12 16h.01\"/>"),
    QUOTE: svgMask("<path d=\"M3 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2H4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2h2c0 2-1 3-3 3\"/><path d=\"M15 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2h-4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2h2c0 2-1 3-3 3\"/>"),
    TIP: svgMask("<path d=\"M15 14c.2-1 .7-1.7 1.5-2.5A4.9 4.9 0 0 0 18 8 6 6 0 0 0 6 8c0 1.3.4 2.5 1.5 3.5.7.7 1.3 1.5 1.5 2.5\"/><path d=\"M9 18h6\"/><path d=\"M10 22h4\"/>"),
    WARNING: svgMask("<path d=\"m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/>"),
    CAUTION: svgMask("<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 8v4\"/><path d=\"M12 16h.01\"/>"),
    QUESTION: svgMask("<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3\"/><path d=\"M12 17h.01\"/>"),
};

export const DEFAULT_CALLOUT_ICON_MASK = CALLOUT_ICON_MASKS.NOTE;

export function normalizeCalloutLabel(label: string) {
    return (label || "").trim();
}

export function parseCalloutKeywordsInput(text: string) {
    return [...new Set(text.split(/[,，;；|\n]/).map((part) => part.trim()).filter(Boolean))];
}

export function formatCalloutKeywordsForInput(keywords: string[]) {
    return keywords.join(", ");
}

export function normalizeCalloutKeywords(raw: string[] | string | undefined, fallback = "") {
    if (Array.isArray(raw)) {
        const normalized = [...new Set(raw.map((part) => part.trim()).filter(Boolean))];
        if (normalized.length) return normalized;
    } else if (typeof raw === "string" && raw.trim()) {
        return parseCalloutKeywordsInput(raw);
    }
    const fb = (fallback || "").trim();
    return fb ? [fb] : [];
}

export function formatCalloutTitleFromLabel(label: string) {
    const trimmed = normalizeCalloutLabel(label);
    if (!trimmed) return "";
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

/**
 * Capitalized callout title used in previews, menus, dialog captions, and list rows.
 * Mirrors SiYuan's `[!LABEL]` → first-letter-uppercase display rule.
 */
export function getCalloutPreviewTitle(item: Pick<CalloutTypeItem, "label">) {
    return formatCalloutTitleFromLabel(item.label) || item.label;
}

/** Built-in SiYuan callout labels that cannot be renamed or deleted in settings. */
export const PROTECTED_CALLOUT_LABELS = new Set(["NOTE", "IMPORTANT", "TIP", "WARNING", "CAUTION"]);

export function isProtectedCalloutType(item: Pick<CalloutTypeItem, "label">) {
    return PROTECTED_CALLOUT_LABELS.has((item.label || "").trim().toUpperCase());
}

export function calloutMatchesFilter(item: Pick<CalloutTypeItem, "label" | "keywords">, filterText: string) {
    const q = filterText.trim().toLowerCase();
    if (!q) return true;
    if (normalizeCalloutLabel(item.label).toLowerCase().includes(q)) return true;
    return (item.keywords || []).some((keyword) => keyword.toLowerCase().includes(q));
}

/** Settings list search: label + keywords + historical labels (case-insensitive). */
export function calloutMatchesListSearch(
    item: Pick<CalloutTypeItem, "label" | "keywords" | "historicalLabels">,
    filterText: string,
) {
    const q = filterText.trim().toLowerCase();
    if (!q) return true;
    if (calloutMatchesFilter(item, filterText)) return true;
    return (item.historicalLabels || []).some((label) => label.toLowerCase().includes(q));
}

export function getCalloutIconMask(label: string) {
    return CALLOUT_ICON_MASKS[(label || "").trim().toUpperCase()] || DEFAULT_CALLOUT_ICON_MASK;
}

export function resolveCalloutIconMask(iconOrLabel: string, fallbackLabel = ""): string {
    const raw = (iconOrLabel || "").trim();
    if (raw.startsWith(SYMBOL_PREFIX)) {
        const symbolId = raw.slice(SYMBOL_PREFIX.length).trim();
        const mask = symbolToMaskUrl(symbolId);
        if (mask) return mask;
        return getCalloutIconMask(fallbackLabel || "");
    }
    if (raw.startsWith("url(")) return raw;
    if (raw.startsWith("var(")) return resolveCalloutIconMask(resolveCssVarReference(raw), fallbackLabel);
    if (raw.startsWith("data:image/svg+xml")) return `url("${raw}")`;
    if (raw) {
        const key = raw.toUpperCase();
        if (CALLOUT_ICON_MASKS[key]) return CALLOUT_ICON_MASKS[key];
    }
    return getCalloutIconMask(fallbackLabel || raw);
}

function resolveCssVarReference(value: string) {
    if (typeof document === "undefined") return "";
    const match = value.match(/^var\(\s*(--[^,)]+)(?:\s*,\s*([^)]+))?\s*\)$/i);
    if (!match) return "";

    const host = document.createElement("div");
    host.className = "callout";
    host.dataset.type = "NodeCallout";
    host.style.position = "absolute";
    host.style.visibility = "hidden";
    host.style.pointerEvents = "none";
    host.style.left = "-99999px";
    host.style.top = "-99999px";
    document.body.appendChild(host);
    const resolved = getComputedStyle(host).getPropertyValue(match[1]).trim() || (match[2] || "").trim();
    host.remove();
    return resolved;
}

export function getEditorCalloutIconMask(label: string, fallbackIcon = "") {
    if (typeof document === "undefined") return resolveCalloutIconMask(fallbackIcon || label, label);

    const subtype = normalizeCalloutLabel(label);
    if (!subtype) return resolveCalloutIconMask(fallbackIcon || label, label);

    const host = document.createElement("div");
    host.className = "protyle-wysiwyg";
    host.style.position = "absolute";
    host.style.visibility = "hidden";
    host.style.pointerEvents = "none";
    host.style.left = "-99999px";
    host.style.top = "-99999px";

    const probe = document.createElement("div");
    probe.className = "callout";
    probe.dataset.type = "NodeCallout";
    probe.dataset.subtype = subtype.toUpperCase();
    host.appendChild(probe);
    document.body.appendChild(host);

    const computed = getComputedStyle(probe, "::before");
    const mask = computed.webkitMaskImage || computed.maskImage || "";
    host.remove();

    if (mask && mask !== "none") return mask;
    return resolveCalloutIconMask(fallbackIcon || label, label);
}

type CalloutIconRenderOptions = {
    preferEditorIcon?: boolean;
    subtype?: string;
    size?: string;
};

export function applyCalloutIconMask(element: HTMLElement, iconOrLabel: string, fallbackLabel = "", options: CalloutIconRenderOptions = {}) {
    const mask = options.preferEditorIcon
        ? getEditorCalloutIconMask(options.subtype || fallbackLabel || iconOrLabel, iconOrLabel)
        : resolveCalloutIconMask(iconOrLabel, fallbackLabel);
    element.style.backgroundColor = "currentColor";
    element.style.webkitMaskImage = mask;
    element.style.maskImage = mask;
    element.style.webkitMaskRepeat = "no-repeat";
    element.style.maskRepeat = "no-repeat";
    element.style.webkitMaskSize = "contain";
    element.style.maskSize = "contain";
    element.style.webkitMaskPosition = "center";
    element.style.maskPosition = "center";
    if (options.size) {
        element.style.width = options.size;
        element.style.height = options.size;
        element.style.minWidth = options.size;
        element.style.flexShrink = "0";
    }
    return mask;
}

export function renderCalloutIconSpan(iconOrLabel: string, className = "", fallbackLabel = "", options: CalloutIconRenderOptions = {}) {
    const span = document.createElement("span");
    if (className) span.className = className;
    const ref = parseIconRef(iconOrLabel);
    if (ref.kind === "symbol" && hasSymbol(ref.id)) {
        const size = options.size || "1em";
        span.style.display = "inline-flex";
        span.style.alignItems = "center";
        span.style.justifyContent = "center";
        span.style.color = "currentColor";
        span.style.backgroundColor = "transparent";
        if (options.size) {
            span.style.width = options.size;
            span.style.height = options.size;
            span.style.minWidth = options.size;
            span.style.flexShrink = "0";
        }
        span.innerHTML = renderSymbolUseHtml(ref.id, size);
        return span;
    }
    applyCalloutIconMask(span, iconOrLabel, fallbackLabel, options);
    return span;
}

export const DEFAULT_CALLOUT_TYPES: CalloutTypeItem[] = [
    { id: "info", label: "Info", keywords: ["Info"], historicalLabels: [], icon: getCalloutIconMask("Info"), color: "", order: 0, enabled: true },
    { id: "note", label: "NOTE", keywords: ["Note"], historicalLabels: [], icon: getCalloutIconMask("NOTE"), color: "", order: 1, enabled: true },
    { id: "important", label: "IMPORTANT", keywords: ["Important"], historicalLabels: [], icon: getCalloutIconMask("IMPORTANT"), color: "", order: 2, enabled: true },
    { id: "quote", label: "Quote", keywords: ["Quote"], historicalLabels: [], icon: getCalloutIconMask("Quote"), color: "", order: 3, enabled: true },
    { id: "tip", label: "TIP", keywords: ["Tip"], historicalLabels: [], icon: getCalloutIconMask("TIP"), color: "", order: 4, enabled: true },
    { id: "warning", label: "WARNING", keywords: ["Warning"], historicalLabels: [], icon: getCalloutIconMask("WARNING"), color: "", order: 5, enabled: true },
    { id: "caution", label: "CAUTION", keywords: ["Caution"], historicalLabels: [], icon: getCalloutIconMask("CAUTION"), color: "", order: 6, enabled: true },
    { id: "question", label: "Question", keywords: ["Question"], historicalLabels: [], icon: getCalloutIconMask("Question"), color: "", order: 7, enabled: true },
];
