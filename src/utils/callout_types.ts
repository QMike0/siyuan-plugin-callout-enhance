import { hasSymbol, parseIconRef, renderSymbolUseHtml, SYMBOL_PREFIX, symbolToMaskUrl } from "./icons";

export type CalloutTypeItem = {
    id: string;
    keyword: string;
    label: string;
    icon: string;
    color: string;
    order: number;
    enabled: boolean;
};

function svgMask(paths: string) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export const CALLOUT_ICON_MASKS: Record<string, string> = {
    INFO: svgMask(`<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>`),
    NOTE: svgMask(`<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>`),
    IMPORTANT: svgMask(`<path d="M12 2v20"/><path d="m17 5-5-3-5 3"/><path d="m17 19-5 3-5-3"/>`),
    QUOTE: svgMask(`<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2H4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2h2c0 2-1 3-3 3"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2h-4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2h2c0 2-1 3-3 3"/>`),
    TIP: svgMask(`<path d="M15 14c.2-1 .7-1.7 1.5-2.5A4.9 4.9 0 0 0 18 8 6 6 0 0 0 6 8c0 1.3.4 2.5 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>`),
    WARNING: svgMask(`<path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>`),
    CAUTION: svgMask(`<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0"/>`),
    QUESTION: svgMask(`<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>`),
};

export function getCalloutIconMask(keyword: string) {
    return CALLOUT_ICON_MASKS[(keyword || "").trim().toUpperCase()] || CALLOUT_ICON_MASKS.INFO;
}

export function resolveCalloutIconMask(iconOrKeyword: string, fallbackKeyword = "") {
    const raw = (iconOrKeyword || "").trim();
    if (raw.startsWith(SYMBOL_PREFIX)) {
        const symbolId = raw.slice(SYMBOL_PREFIX.length).trim();
        const mask = symbolToMaskUrl(symbolId);
        if (mask) return mask;
        // Missing symbol -- fall through to keyword-based default.
        return getCalloutIconMask(fallbackKeyword || "");
    }
    if (raw.startsWith("url(")) return raw;
    if (raw.startsWith("data:image/svg+xml")) return `url("${raw}")`;
    if (raw) {
        const key = raw.toUpperCase();
        if (CALLOUT_ICON_MASKS[key]) return CALLOUT_ICON_MASKS[key];
    }
    return getCalloutIconMask(fallbackKeyword || raw);
}

export function getEditorCalloutIconMask(keyword: string, fallbackIcon = "") {
    if (typeof document === "undefined") return resolveCalloutIconMask(fallbackIcon || keyword, keyword);

    const subtype = (keyword || "").trim();
    if (!subtype) return resolveCalloutIconMask(fallbackIcon || keyword, keyword);

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
    return resolveCalloutIconMask(fallbackIcon || keyword, keyword);
}

type CalloutIconRenderOptions = {
    preferEditorIcon?: boolean;
    subtype?: string;
    size?: string;
};

export function applyCalloutIconMask(element: HTMLElement, iconOrKeyword: string, fallbackKeyword = "", options: CalloutIconRenderOptions = {}) {
    const mask = options.preferEditorIcon
        ? getEditorCalloutIconMask(options.subtype || fallbackKeyword || iconOrKeyword, iconOrKeyword)
        : resolveCalloutIconMask(iconOrKeyword, fallbackKeyword);
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

export function renderCalloutIconSpan(iconOrKeyword: string, className = "", fallbackKeyword = "", options: CalloutIconRenderOptions = {}) {
    const span = document.createElement("span");
    if (className) span.className = className;
    const ref = parseIconRef(iconOrKeyword);
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
        // Use HTML-string injection so the browser parses the <svg> / <use>
        // pair with the correct SVG/xlink namespaces -- the same pattern
        // SiYuan and sy-bookmark-plus rely on for sprite icons. Programmatic
        // createElementNS + setAttribute("xlink:href") is not equivalent and
        // silently fails to paint in some Electron builds.
        span.innerHTML = renderSymbolUseHtml(ref.id, size);
        return span;
    }
    applyCalloutIconMask(span, iconOrKeyword, fallbackKeyword, options);
    return span;
}

export const DEFAULT_CALLOUT_TYPES: CalloutTypeItem[] = [
    { id: "info", keyword: "Info", label: "Info", icon: getCalloutIconMask("Info"), color: "", order: 0, enabled: true },
    { id: "note", keyword: "NOTE", label: "Note", icon: getCalloutIconMask("NOTE"), color: "", order: 1, enabled: true },
    { id: "important", keyword: "IMPORTANT", label: "Important", icon: getCalloutIconMask("IMPORTANT"), color: "", order: 2, enabled: true },
    { id: "quote", keyword: "Quote", label: "Quote", icon: getCalloutIconMask("Quote"), color: "", order: 3, enabled: true },
    { id: "tip", keyword: "TIP", label: "Tip", icon: getCalloutIconMask("TIP"), color: "", order: 4, enabled: true },
    { id: "warning", keyword: "WARNING", label: "Warning", icon: getCalloutIconMask("WARNING"), color: "", order: 5, enabled: true },
    { id: "caution", keyword: "CAUTION", label: "Caution", icon: getCalloutIconMask("CAUTION"), color: "", order: 6, enabled: true },
    { id: "question", keyword: "Question", label: "Question", icon: getCalloutIconMask("Question"), color: "", order: 7, enabled: true },
];
