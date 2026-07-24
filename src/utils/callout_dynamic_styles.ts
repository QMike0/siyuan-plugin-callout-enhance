/**
 * Unified callout appearance stylesheet builder (Phase A–C).
 *
 * Produces `#callout-enhance-dynamic-styles` content: layout vars + per-subtype
 * --local-color and ::before icon masks/images. Empty type color resolves to the
 * same built-in CSS variables as index.scss fallback rules.
 *
 * `symbol:*` icons are baked into ::before (mask or full-color image). Rebake
 * after SiYuan icon scripts load so third-party packs replace litheness snapshots.
 *
 * `buildCalloutStaticStylesheet()` is emitted at build time into
 * `src/callout_defaults.css` (palette + default built-in subtype rules).
 */

import { CalloutTypeItem, DEFAULT_CALLOUT_ICON_MASK, getCalloutStyleSubtypes, normalizeCalloutLabel, resolveCalloutIconPaint } from "./callout_types";
import { buildCalloutLayoutStylesheet, CalloutLayoutSettings, normalizeCalloutLayout } from "./callout_layout_vars";
import { CalloutEnhanceSettings, createDefaultCalloutSettings, getAllResolvedCalloutTypes } from "./settings";

export type PreviewIconSource = "editor" | "draft";

export const DYNAMIC_STYLE_ID = "callout-enhance-dynamic-styles";

/**
 * SiYuan PDF/HTML export collects `<style id="snippetCSS*">` from the editor window
 * (see siyuan app/protyle/export/index.ts getSnippetCSS). Mirror dynamic callout CSS here
 * so export previews/results match the editor without running plugin JS in export windows.
 */
export const EXPORT_SNIPPET_STYLE_ID = "snippetCSSCalloutEnhance";

export type BuiltinCalloutPaletteEntry = {
    label: string;
    cssVar: string;
    hex: string;
};

/** Single source for built-in callout palette (hex → CSS var at build time). */
export const BUILTIN_CALLOUT_PALETTE: readonly BuiltinCalloutPaletteEntry[] = [
    { label: "info", cssVar: "--callout-color-info", hex: "#086ddd" },
    { label: "note", cssVar: "--callout-color-default", hex: "#00BFBC" },
    { label: "tip", cssVar: "--callout-color-tip", hex: "#08B94D" },
    { label: "quote", cssVar: "--callout-color-quote", hex: "#7f8c8d" },
    { label: "question", cssVar: "--callout-color-question", hex: "#EC7500" },
    { label: "important", cssVar: "--callout-color-important", hex: "#7852EE" },
    { label: "warning", cssVar: "--callout-color-warning", hex: "#EC7500" },
    { label: "caution", cssVar: "--callout-color-caution", hex: "#E93147" },
];

/** Built-in label → `--callout-color-*` token (derived from {@link BUILTIN_CALLOUT_PALETTE}). */
export const BUILTIN_LABEL_COLOR_VAR: Record<string, string> = BUILTIN_CALLOUT_PALETTE.reduce(
    (record, entry) => {
        record[entry.label] = entry.cssVar;
        return record;
    },
    {} as Record<string, string>,
);

export type BuildCalloutDynamicStylesheetOptions = {
    settings: Partial<CalloutEnhanceSettings> | null | undefined;
    layout: CalloutLayoutSettings;
};

function escapeCssString(value: string) {
    return (value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n|\r|\f/g, "");
}

export function safeCssValue(value: string) {
    const trimmed = (value || "").trim();
    if (/^url\(/i.test(trimmed)) {
        return trimmed.replace(/[{}\n\r\f]/g, "");
    }
    return trimmed.replace(/[;{}\n\r\f]/g, "");
}

function isValidCssColor(value: string) {
    if (!value) return false;
    if (typeof window === "undefined" || !window.CSS?.supports) return true;
    return CSS.supports("color", value);
}

export function resolveBuiltinColorVarForLabel(label: string) {
    const key = normalizeCalloutLabel(label).toLowerCase();
    return BUILTIN_LABEL_COLOR_VAR[key] || "--callout-color-default";
}

/** Resolved CSS value for `--local-color` (custom hex/rgb or built-in var()). */
export function resolveCalloutTypeColorValue(item: Pick<CalloutTypeItem, "label" | "color">) {
    const custom = safeCssValue(item.color || "");
    if (custom && isValidCssColor(custom)) {
        return custom;
    }
    return `var(${resolveBuiltinColorVarForLabel(item.label)})`;
}

function buildCalloutIconBeforeRule(selector: string, paint: { mode: "mask" | "image"; url: string }) {
    const url = safeCssValue(paint.url);
    if (paint.mode === "image") {
        return (
            `${selector}::before{` +
            `background-color:transparent;` +
            `background-image:${url};` +
            `background-size:contain;` +
            `background-repeat:no-repeat;` +
            `background-position:center;` +
            `-webkit-mask-image:none;` +
            `mask-image:none;` +
            `-webkit-mask:none;` +
            `mask:none` +
            `}`
        );
    }
    return (
        `${selector}::before{` +
        `background-color:currentColor;` +
        `background-image:none;` +
        `-webkit-mask:${url} center / contain no-repeat;` +
        `mask:${url} center / contain no-repeat` +
        `}`
    );
}

/** Per-subtype color + ::before icon rules (shared by runtime + build snapshot). */
export function buildCalloutTypeAppearanceStylesheet(
    settings: Partial<CalloutEnhanceSettings> | null | undefined,
): string {
    const rules: string[] = [];

    getAllResolvedCalloutTypes(settings).forEach((item) => {
        const subtypes = getCalloutStyleSubtypes(item);
        if (!subtypes.length) return;

        const colorValue = resolveCalloutTypeColorValue(item);
        const colorDecl = `--local-color:${colorValue}`;
        const paint = resolveCalloutIconPaint(item.icon || item.label, item.label);

        for (const subtype of subtypes) {
            const selector = `.callout[data-type="NodeCallout"][data-subtype="${escapeCssString(subtype)}" i]`;
            rules.push(`${selector}{${colorDecl}}`);
            rules.push(buildCalloutIconBeforeRule(selector, paint));
        }
    });

    return rules.join("\n");
}

/** Built-in palette + default icon mask on `.callout[data-type="NodeCallout"]`. */
export function buildCalloutPaletteStylesheet(): string {
    const decls = [
        ...BUILTIN_CALLOUT_PALETTE.map((entry) => `${entry.cssVar}:${entry.hex}`),
        `--callout-icon-mask-default:${safeCssValue(DEFAULT_CALLOUT_ICON_MASK)}`,
    ].join(";");
    return `.callout[data-type="NodeCallout"]{${decls}}`;
}

/** Default built-in types only — per-subtype `--local-color` and icon masks. */
export function buildDefaultCalloutTypesStylesheet(): string {
    return buildCalloutTypeAppearanceStylesheet(createDefaultCalloutSettings());
}

/** Palette + default subtype rules — written to `callout_defaults.css` at build time. */
export function buildCalloutStaticStylesheet(): string {
    return [buildCalloutPaletteStylesheet(), buildDefaultCalloutTypesStylesheet()].filter(Boolean).join("\n");
}

export type ResolvePreviewCalloutIconMaskOptions = {
    source?: PreviewIconSource;
    editorMaskResolver?: (label: string, icon?: string) => string;
    editorPaintResolver?: (label: string, icon?: string) => { mode: "mask" | "image"; url: string };
};

/** Settings preview icon paint — same resolution order as dynamic sheet, with draft/editor nuance. */
export function resolvePreviewCalloutIconPaint(
    item: Pick<CalloutTypeItem, "label" | "icon">,
    options: ResolvePreviewCalloutIconMaskOptions = {},
) {
    const source = options.source || "editor";
    if (source === "draft" && item.icon?.trim()) {
        return resolveCalloutIconPaint(item.icon, item.label);
    }
    if (options.editorPaintResolver) {
        return options.editorPaintResolver(item.label, item.icon);
    }
    if (options.editorMaskResolver) {
        return { mode: "mask" as const, url: options.editorMaskResolver(item.label, item.icon) };
    }
    return resolveCalloutIconPaint(item.icon || item.label, item.label);
}

/** @deprecated Prefer {@link resolvePreviewCalloutIconPaint}. */
export function resolvePreviewCalloutIconMask(
    item: Pick<CalloutTypeItem, "label" | "icon">,
    options: ResolvePreviewCalloutIconMaskOptions = {},
): string {
    return resolvePreviewCalloutIconPaint(item, options).url;
}

/** Inline preview tokens (Phase C): keeps instant updates without touching the dynamic sheet. */
export function applyPreviewCalloutInlineStyle(
    element: HTMLElement,
    item: Pick<CalloutTypeItem, "label" | "color" | "icon">,
    options: ResolvePreviewCalloutIconMaskOptions = {},
) {
    const paint = resolvePreviewCalloutIconPaint(item, options);
    element.style.setProperty("--local-color", resolveCalloutTypeColorValue(item));
    element.classList.remove("callout-enhance-live-icon");
    element.classList.toggle("callout-enhance-icon--native", paint.mode === "image");
    if (paint.mode === "image") {
        element.style.setProperty("--callout-enhance-preview-icon-image", safeCssValue(paint.url));
        element.style.setProperty("--callout-enhance-preview-icon-mask", "none");
    } else {
        element.style.removeProperty("--callout-enhance-preview-icon-image");
        element.style.setProperty(
            "--callout-enhance-preview-icon-mask",
            safeCssValue(paint.url),
        );
    }
}

export function buildCalloutDynamicStylesheet(options: BuildCalloutDynamicStylesheetOptions): string {
    const layout = normalizeCalloutLayout(options.layout);
    const rules: string[] = [];

    const layoutCss = buildCalloutLayoutStylesheet(layout);
    if (layoutCss) rules.push(layoutCss);

    const appearanceCss = buildCalloutTypeAppearanceStylesheet(options.settings);
    if (appearanceCss) rules.push(appearanceCss);

    return rules.join("\n");
}

export function applyCalloutDynamicStylesheet(css: string, styleId = DYNAMIC_STYLE_ID) {
    if (typeof document === "undefined") return;
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
        style = document.createElement("style");
        style.id = styleId;
        document.head.appendChild(style);
    }
    style.textContent = css;
}

/** Keep export PDF/HTML in sync with editor dynamic callout rules (via SiYuan snippetCSS hook). */
export function syncCalloutExportStylesheet(css: string, styleId = EXPORT_SNIPPET_STYLE_ID) {
    applyCalloutDynamicStylesheet(css, styleId);
}

export function removeCalloutDynamicStylesheet(styleId = DYNAMIC_STYLE_ID) {
    if (typeof document === "undefined") return;
    document.getElementById(styleId)?.remove();
}

export function removeCalloutExportStylesheet(styleId = EXPORT_SNIPPET_STYLE_ID) {
    removeCalloutDynamicStylesheet(styleId);
}
