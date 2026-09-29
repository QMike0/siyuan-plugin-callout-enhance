/**
 * Callout layout CSS custom properties defined on `.callout[data-type="NodeCallout"]`.
 * Defaults mirror `index.scss`; injected at runtime via `#callout-enhance-dynamic-styles`.
 */

export type CalloutLayoutSettings = Record<string, string>;

export type CalloutLayoutFieldKind = "length" | "percent" | "opacity" | "time" | "text" | "select";

export type CalloutLayoutFieldDef = {
    varName: string;
    label: string;
    group: string;
    kind: CalloutLayoutFieldKind;
    defaultValue: string;
    unit?: string;
    step?: number;
    min?: number;
    max?: number;
    options?: { value: string; label: string }[];
    /** i18n key for optional help tooltip beside the field label */
    helpTooltipKey?: string;
};

export const DEFAULT_CALLOUT_LAYOUT: CalloutLayoutSettings = {
    "--callout-shell-padding-top": "10px",
    "--callout-shell-padding-right": "0px",
    "--callout-shell-padding-bottom": "4px",
    "--callout-shell-padding-left": "12px",
    "--callout-header-width-offset": "2px",
    "--callout-header-height": "28px",
    "--callout-header-y-adjust": "-3px",
    "--callout-title-font-weight": "bold",
    "--callout-title-font-size": "1em",
    "--callout-title-line-height": "1.625",
    "--callout-title-opacity": "1",
    "--callout-title-padding-right": "28px",
    "--callout-header-background": "var(--callout-surface-background)",
    "--callout-icon-size": "1em",
    "--callout-icon-left": "20px",
    "--callout-icon-title-gap": "2px",
    "--callout-icon-before-display": "inline-block",
    "--callout-left-accent-width": "0px",
    "--callout-body-padding-x": "10px",
    "--callout-body-padding-bottom": "12px",
    "--callout-body-gap-top": "4px",
    "--callout-body-background": "var(--callout-surface-background)",
    "--callout-scroll-max-height": "500px",
    "--callout-border-radius": "6px",
    "--callout-border-width": "0px",
    "--callout-fold-hit-width": "40px",
    "--callout-fold-icon-size": "1.25em",
    "--callout-fold-icon-right": "0.5em",
    "--callout-fold-after-display": "block",
    "--callout-fold-duration": "180ms",
};

type CalloutLayoutFieldSpec = Omit<CalloutLayoutFieldDef, "defaultValue">;

function withLayoutFieldDefaults(specs: CalloutLayoutFieldSpec[]): CalloutLayoutFieldDef[] {
    return specs.map((field) => ({
        ...field,
        defaultValue: DEFAULT_CALLOUT_LAYOUT[field.varName] ?? "",
    }));
}

/** Vars copied to settings preview probes. */
export const CALLOUT_LAYOUT_CSS_VARS = Object.keys(DEFAULT_CALLOUT_LAYOUT) as (keyof typeof DEFAULT_CALLOUT_LAYOUT)[];

export const CALLOUT_TITLE_COMPUTED_PROPS = [
    "font-size",
    "line-height",
    "font-weight",
    "letter-spacing",
    "opacity",
    "padding-right",
] as const;

export const CALLOUT_LAYOUT_FIELD_GROUPS = [
    "Shell",
    "Title",
    "Body",
    "Icon",
    "Fold",
] as const;

const CALLOUT_LAYOUT_FIELD_SPECS: CalloutLayoutFieldSpec[] = [
    { varName: "--callout-shell-padding-top", label: "Padding top", group: "Shell", kind: "length", unit: "px", step: 1, min: 0, max: 48 },
    { varName: "--callout-shell-padding-right", label: "Padding right", group: "Shell", kind: "length", unit: "px", step: 1, min: 0, max: 48 },
    { varName: "--callout-shell-padding-bottom", label: "Padding bottom", group: "Shell", kind: "length", unit: "px", step: 1, min: 0, max: 48 },
    { varName: "--callout-shell-padding-left", label: "Padding left", group: "Shell", kind: "length", unit: "px", step: 1, min: 0, max: 48 },
    { varName: "--callout-border-radius", label: "Border radius", group: "Shell", kind: "length", unit: "px", step: 1, min: 0, max: 24 },
    { varName: "--callout-border-width", label: "Outer border width", group: "Shell", kind: "length", unit: "px", step: 1, min: 0, max: 8 },
    { varName: "--callout-left-accent-width", label: "Left bar width", group: "Shell", kind: "length", unit: "px", step: 1, min: 0, max: 12 },

    { varName: "--callout-title-font-size", label: "Font scale", group: "Title", kind: "length", unit: "em", step: 0.05, min: 0.5, max: 3, helpTooltipKey: "helpTitleFontScale" },
    { varName: "--callout-title-font-weight", label: "Font weight", group: "Title", kind: "select", options: [
        { value: "normal", label: "Normal" },
        { value: "500", label: "500" },
        { value: "600", label: "600" },
        { value: "bold", label: "Bold" },
        { value: "700", label: "700" },
    ] },
    { varName: "--callout-title-line-height", label: "Line height", group: "Title", kind: "text" },
    { varName: "--callout-title-opacity", label: "Font opacity", group: "Title", kind: "opacity", step: 0.05, min: 0, max: 1 },
    { varName: "--callout-title-padding-right", label: "Padding right", group: "Title", kind: "length", unit: "px", step: 1, min: 0, max: 64 },
    { varName: "--callout-header-height", label: "Header height", group: "Title", kind: "length", unit: "px", step: 1, min: 16, max: 64 },
    { varName: "--callout-header-y-adjust", label: "Vertical position", group: "Title", kind: "length", unit: "px", step: 1, min: -16, max: 16 },
    { varName: "--callout-header-width-offset", label: "Horizontal position", group: "Title", kind: "length", unit: "px", step: 1, min: -16, max: 32 },
    { varName: "--callout-header-background", label: "Background", group: "Title", kind: "select", options: [
        { value: "var(--callout-surface-background)", label: "Tinted" },
        { value: "transparent", label: "Transparent" },
    ] },

    { varName: "--callout-icon-size", label: "Icon scale", group: "Icon", kind: "length", unit: "em", step: 0.05, min: 0.5, max: 3, helpTooltipKey: "helpIconScale" },
    { varName: "--callout-icon-left", label: "Icon–left edge gap", group: "Icon", kind: "length", unit: "px", step: 1, min: 0, max: 64 },
    { varName: "--callout-icon-title-gap", label: "Icon–title gap", group: "Icon", kind: "length", unit: "px", step: 1, min: 0, max: 24 },
    { varName: "--callout-icon-before-display", label: "Show icon", group: "Icon", kind: "select", options: [
        { value: "inline-block", label: "Show" },
        { value: "none", label: "Hide" },
    ] },

    { varName: "--callout-body-padding-x", label: "Padding horizontal", group: "Body", kind: "length", unit: "px", step: 1, min: 0, max: 48 },
    { varName: "--callout-body-padding-bottom", label: "Padding bottom", group: "Body", kind: "length", unit: "px", step: 1, min: 0, max: 48 },
    { varName: "--callout-body-gap-top", label: "Gap below title", group: "Body", kind: "length", unit: "px", step: 1, min: 0, max: 32 },
    { varName: "--callout-body-background", label: "Background", group: "Body", kind: "select", options: [
        { value: "var(--callout-surface-background)", label: "Tinted" },
        { value: "transparent", label: "Transparent" },
    ] },
    { varName: "--callout-scroll-max-height", label: "Max height limit", group: "Body", kind: "length", unit: "px", step: 10, min: 100, max: 2000, helpTooltipKey: "helpScrollMaxHeight" },

    { varName: "--callout-fold-after-display", label: "Show fold button", group: "Fold", kind: "select", options: [
        { value: "block", label: "Show" },
        { value: "none", label: "Hide" },
    ] },
    { varName: "--callout-fold-hit-width", label: "Click area width", group: "Fold", kind: "length", unit: "px", step: 1, min: 16, max: 80 },
    { varName: "--callout-fold-icon-size", label: "Button size", group: "Fold", kind: "length", unit: "em", step: 0.05, min: 0.5, max: 2.5 },
    { varName: "--callout-fold-icon-right", label: "Button–right edge gap", group: "Fold", kind: "length", unit: "em", step: 0.05, min: 0, max: 3 },
    { varName: "--callout-fold-duration", label: "Fold/expand animation duration", group: "Fold", kind: "time", unit: "ms", step: 10, min: 0, max: 2000 },
];

export const CALLOUT_LAYOUT_FIELDS: CalloutLayoutFieldDef[] = withLayoutFieldDefaults(CALLOUT_LAYOUT_FIELD_SPECS);

export function areCalloutLayoutsEqual(
    left?: CalloutLayoutSettings | null,
    right?: CalloutLayoutSettings | null,
): boolean {
    const a = normalizeCalloutLayout(left);
    const b = normalizeCalloutLayout(right);
    return CALLOUT_LAYOUT_CSS_VARS.every((key) => a[key] === b[key]);
}

function safeCssValue(value: string) {
    return (value || "").trim().replace(/[;{}\n\r\f]/g, "");
}

/** 12pt title and 16px icon both match 1em at SiYuan's default 16px editor font. */
const TITLE_PT_PER_EDITOR_EM = 12;
const PX_PER_EDITOR_EM = 16;

function roundEditorScale(value: number) {
    return Math.round(value * 1000) / 1000;
}

function migrateEditorRelativeLength(value: string, fallback: string) {
    const trimmed = (value || "").trim();
    if (/^[\d.]+em$/.test(trimmed)) return trimmed;

    const percentMatch = trimmed.match(/^([\d.]+)%$/);
    if (percentMatch) {
        const percent = Number(percentMatch[1]);
        if (Number.isFinite(percent) && percent > 0) return `${roundEditorScale(percent / 100)}em`;
    }
    const ptMatch = trimmed.match(/^([\d.]+)pt$/);
    if (ptMatch) {
        const pt = Number(ptMatch[1]);
        if (Number.isFinite(pt) && pt > 0) return `${roundEditorScale(pt / TITLE_PT_PER_EDITOR_EM)}em`;
    }
    const pxMatch = trimmed.match(/^([\d.]+)px$/);
    if (pxMatch) {
        const px = Number(pxMatch[1]);
        if (Number.isFinite(px) && px > 0) return `${roundEditorScale(px / PX_PER_EDITOR_EM)}em`;
    }
    return fallback;
}

/** Settings previews sit outside the editor, so give them the editor font size for em scales. */
export function applyEditorFontContext(host: HTMLElement) {
    const fontSize = Number((window as Window & {
        siyuan?: { config?: { editor?: { fontSize?: number } } };
    }).siyuan?.config?.editor?.fontSize);
    if (Number.isFinite(fontSize) && fontSize > 0) {
        host.style.fontSize = `${fontSize}px`;
    }
}

export type CalloutLayoutVarName = keyof typeof DEFAULT_CALLOUT_LAYOUT;

/**
 * Read a numeric length from computed callout layout CSS variables.
 * Optional legacyVar covers SCSS aliases (e.g. --callout-header-x-shift).
 * Valid 0 is preserved; only missing/invalid values fall back to legacy then DEFAULT.
 */
export function resolveSpecifiedCssLengthPx(styles: CSSStyleDeclaration, raw: string): number | null {
    const trimmed = (raw || "").trim();
    const num = parseFloat(trimmed);
    if (!Number.isFinite(num)) return null;
    if (trimmed.endsWith("em")) {
        const fontSize = parseFloat(styles.fontSize);
        return num * (Number.isFinite(fontSize) && fontSize > 0 ? fontSize : PX_PER_EDITOR_EM);
    }
    if (trimmed.endsWith("pt")) {
        return num * (96 / 72);
    }
    return num;
}

export function resolveCalloutLayoutLength(
    styles: CSSStyleDeclaration,
    varName: CalloutLayoutVarName,
    legacyVar?: string,
): number {
    const primary = resolveSpecifiedCssLengthPx(styles, styles.getPropertyValue(varName));
    if (primary != null) return primary;
    if (legacyVar) {
        const legacy = resolveSpecifiedCssLengthPx(styles, styles.getPropertyValue(legacyVar));
        if (legacy != null) return legacy;
    }
    return resolveSpecifiedCssLengthPx(styles, DEFAULT_CALLOUT_LAYOUT[varName]) ?? 0;
}

export function normalizeCalloutLayout(raw?: CalloutLayoutSettings | null): CalloutLayoutSettings {
    const merged: CalloutLayoutSettings = { ...DEFAULT_CALLOUT_LAYOUT };
    if (!raw) return merged;
    Object.entries(raw).forEach(([key, value]) => {
        const trimmed = (value || "").trim();
        if (trimmed && key in DEFAULT_CALLOUT_LAYOUT) {
            merged[key] = key === "--callout-title-font-size" || key === "--callout-icon-size"
                ? migrateEditorRelativeLength(trimmed, DEFAULT_CALLOUT_LAYOUT[key])
                : trimmed;
        }
    });
    return merged;
}

export function buildCalloutLayoutStylesheet(layout: CalloutLayoutSettings) {
    const resolved = normalizeCalloutLayout(layout);
    const declarations = CALLOUT_LAYOUT_CSS_VARS
        .map((name) => {
            const value = safeCssValue(resolved[name] || DEFAULT_CALLOUT_LAYOUT[name] || "");
            return value ? `${name}:${value}` : "";
        })
        .filter(Boolean)
        .join(";");
    if (!declarations) return "";
    return `.callout[data-type="NodeCallout"]{${declarations}}`;
}

export function layoutFieldToInputValue(field: CalloutLayoutFieldDef, stored: string) {
    const value = stored || field.defaultValue;
    switch (field.kind) {
        case "length": {
            const unit = field.unit || "px";
            const match = value.match(new RegExp(`^(-?[\\d.]+)${unit === "px" ? "px" : field.unit}$`));
            if (match) return match[1];
            const num = value.match(/^(-?[\d.]+)/);
            return num ? num[1] : value;
        }
        case "percent": {
            const match = value.match(/^([\d.]+)%$/);
            return match ? match[1] : value.replace(/%$/, "");
        }
        case "time": {
            const match = value.match(/^([\d.]+)ms$/);
            return match ? match[1] : value.replace(/ms$/, "");
        }
        default:
            return value;
    }
}

export function inputValueToLayoutField(field: CalloutLayoutFieldDef, raw: string) {
    const trimmed = (raw || "").trim();
    if (!trimmed) return field.defaultValue;
    switch (field.kind) {
        case "length": {
            const unit = field.unit || "px";
            const num = Number(trimmed);
            if (Number.isNaN(num)) return field.defaultValue;
            return `${num}${unit}`;
        }
        case "percent": {
            const num = Number(trimmed);
            if (Number.isNaN(num)) return field.defaultValue;
            return `${num}%`;
        }
        case "time": {
            const num = Number(trimmed);
            if (Number.isNaN(num)) return field.defaultValue;
            return `${Math.max(0, num)}ms`;
        }
        case "opacity": {
            const num = Number(trimmed);
            if (Number.isNaN(num)) return field.defaultValue;
            return String(Math.min(field.max ?? 1, Math.max(field.min ?? 0, num)));
        }
        default:
            return trimmed;
    }
}
