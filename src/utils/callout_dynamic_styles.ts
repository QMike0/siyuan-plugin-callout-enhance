/**
 * Unified callout appearance stylesheet builder (Phase A–C).
 *
 * Produces `#callout-enhance-dynamic-styles` content: layout vars + per-subtype
 * --local-color and ::before icon masks. Empty type color resolves to the same
 * built-in CSS variables as index.scss fallback rules.
 *
 * `buildDefaultCalloutTypesStylesheet()` is also emitted at build time into
 * `src/callout_defaults.css` (Phase B static fallback).
 */

import { CalloutTypeItem, getCalloutStyleSubtypes, normalizeCalloutLabel, resolveCalloutIconMask } from "./callout_types";
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

/**
 * Built-in label → SCSS `--callout-color-*` token.
 * Keep in sync with `:root` defaults in index.scss.
 */
export const BUILTIN_LABEL_COLOR_VAR: Record<string, string> = {
    info: "--callout-color-info",
    note: "--callout-color-default",
    tip: "--callout-color-tip",
    quote: "--callout-color-quote",
    question: "--callout-color-question",
    important: "--callout-color-important",
    warning: "--callout-color-warning",
    caution: "--callout-color-caution",
};

/** Hex mirror of index.scss for reference / non-DOM consumers. */
export const BUILTIN_CALLOUT_COLOR_HEX: Record<string, string> = {
    info: "#086ddd",
    note: "#00BFBC",
    tip: "#08B94D",
    quote: "#7f8c8d",
    question: "#EC7500",
    important: "#7852EE",
    warning: "#EC7500",
    caution: "#E93147",
    default: "#00BFBC",
};

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
            rules.push(`${selector}::before{-webkit-mask:${mask} center / cover no-repeat;mask:${mask} center / cover no-repeat}`);
        }
    });

    return rules.join("\n");
}

/** Default built-in types only — written to `callout_defaults.css` at build time. */
export function buildDefaultCalloutTypesStylesheet(): string {
    return buildCalloutTypeAppearanceStylesheet(createDefaultCalloutSettings());
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
