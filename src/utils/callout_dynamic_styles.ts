/**
 * Unified callout appearance stylesheet builder (Phase A–C).
 *
 * Produces `#callout-enhance-dynamic-styles` content: layout vars + per-subtype
 * --local-color and ::before icon masks. Empty type color resolves to the same
 * built-in CSS variables as index.scss fallback rules.
 *
 * `buildCalloutStaticStylesheet()` is emitted at build time into
 * `src/callout_defaults.css` (palette + default built-in subtype rules).
 */

import { CalloutTypeItem, DEFAULT_CALLOUT_ICON_MASK, getCalloutStyleSubtypes, normalizeCalloutLabel, resolveCalloutIconMask } from "./callout_types";
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

/** Per-subtype color + ::before icon mask rules (shared by runtime + build snapshot). */
export function buildCalloutTypeAppearanceStylesheet(
    settings: Partial<CalloutEnhanceSettings> | null | undefined,
): string {
    const rules: string[] = [];

    getAllResolvedCalloutTypes(settings).forEach((item) => {
        const subtypes = getCalloutStyleSubtypes(item);
        if (!subtypes.length) return;

        const colorValue = resolveCalloutTypeColorValue(item);
        const colorDecl = `--local-color:${colorValue}`;
        const mask = safeCssValue(resolveCalloutIconMask(item.icon || item.label, item.label));

        for (const subtype of subtypes) {
            const selector = `.callout[data-type="NodeCallout"][data-subtype="${escapeCssString(subtype)}" i]`;
            rules.push(`${selector}{${colorDecl}}`);
            rules.push(`${selector}::before{-webkit-mask:${mask} center / contain no-repeat;mask:${mask} center / contain no-repeat}`);
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
};

/** Settings preview icon mask — same resolution order as dynamic sheet, with draft/editor nuance. */
export function resolvePreviewCalloutIconMask(
    item: Pick<CalloutTypeItem, "label" | "icon">,
    options: ResolvePreviewCalloutIconMaskOptions = {},
): string {
    const source = options.source || "editor";
    if (source === "draft" && item.icon?.trim()) {
        return resolveCalloutIconMask(item.icon, item.label);
    }
    if (options.editorMaskResolver) {
        return options.editorMaskResolver(item.label, item.icon);
    }
    return resolveCalloutIconMask(item.icon || item.label, item.label);
}

/** Inline preview tokens (Phase C): keeps instant updates without touching the dynamic sheet. */
export function applyPreviewCalloutInlineStyle(
    element: HTMLElement,
    item: Pick<CalloutTypeItem, "label" | "color" | "icon">,
    options: ResolvePreviewCalloutIconMaskOptions = {},
) {
    element.style.setProperty("--local-color", resolveCalloutTypeColorValue(item));
    element.style.setProperty(
        "--callout-enhance-preview-icon-mask",
        safeCssValue(resolvePreviewCalloutIconMask(item, options)),
    );
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
