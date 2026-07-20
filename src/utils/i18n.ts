import en from "../i18n/en.json";

export type I18nDict = Record<string, string>;

let activeI18n: I18nDict = en as I18nDict;

export function setPluginI18n(i18n: I18nDict | undefined) {
    activeI18n = { ...(en as I18nDict), ...(i18n || {}) };
}

export function t(key: string, vars?: Record<string, string | number>): string {
    let text = activeI18n[key] ?? (en as I18nDict)[key] ?? key;
    if (!vars) return text;
    Object.entries(vars).forEach(([name, value]) => {
        text = text.split(`\${${name}}`).join(String(value));
    });
    return text;
}

export function layoutFieldLabelKey(varName: string) {
    return `layoutField_${varName.replace(/^--/, "").replace(/-/g, "_")}`;
}

export function layoutFieldLabel(varName: string, fallback: string) {
    const key = layoutFieldLabelKey(varName);
    const text = t(key);
    return text === key ? fallback : text;
}

export function layoutGroupLabel(group: string) {
    const slug = group.replace(/\s+/g, "_").replace(/&/g, "and");
    const key = `layoutGroup_${slug}`;
    const text = t(key);
    return text === key ? group : text;
}

const LAYOUT_OPTION_KEYS: Record<string, string> = {
    Normal: "layoutOption_normal",
    "500": "layoutOption_500",
    "600": "layoutOption_600",
    Bold: "layoutOption_bold",
    "700": "layoutOption_700",
    Tinted: "layoutOption_tinted",
    Transparent: "layoutOption_transparent",
    Show: "layoutOption_show",
    Hide: "layoutOption_hide",
};

export function layoutOptionLabel(label: string) {
    const key = LAYOUT_OPTION_KEYS[label];
    return key ? t(key) : label;
}
