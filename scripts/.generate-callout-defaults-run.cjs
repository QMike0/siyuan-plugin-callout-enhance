var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// scripts/generate-callout-defaults-entry.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));

// src/utils/icons.ts
var SYMBOL_PREFIX = "symbol:";
function makeLucideSymbol(id, paths) {
  return `<symbol id="${id}" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</g></symbol>`;
}
var PLUGIN_SVG_SYMBOLS = {
  iconCalloutInfo: makeLucideSymbol(
    "iconCalloutInfo",
    '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'
  ),
  iconCalloutNote: makeLucideSymbol(
    "iconCalloutNote",
    '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'
  ),
  iconCalloutImportant: makeLucideSymbol(
    "iconCalloutImportant",
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 8v4"/><path d="M12 16h.01"/>'
  ),
  iconCalloutQuote: makeLucideSymbol(
    "iconCalloutQuote",
    '<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2H4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2h2c0 2-1 3-3 3"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2h-4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2h2c0 2-1 3-3 3"/>'
  ),
  iconCalloutTip: makeLucideSymbol(
    "iconCalloutTip",
    '<path d="M15 14c.2-1 .7-1.7 1.5-2.5A4.9 4.9 0 0 0 18 8 6 6 0 0 0 6 8c0 1.3.4 2.5 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>'
  ),
  iconCalloutWarning: makeLucideSymbol(
    "iconCalloutWarning",
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>'
  ),
  iconCalloutCaution: makeLucideSymbol(
    "iconCalloutCaution",
    '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>'
  ),
  iconCalloutQuestion: makeLucideSymbol(
    "iconCalloutQuestion",
    '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>'
  ),
  iconCalloutBookmark: makeLucideSymbol(
    "iconCalloutBookmark",
    '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>'
  ),
  iconCalloutStar: makeLucideSymbol(
    "iconCalloutStar",
    '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'
  ),
  iconCalloutHeart: makeLucideSymbol(
    "iconCalloutHeart",
    '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>'
  ),
  iconCalloutBook: makeLucideSymbol(
    "iconCalloutBook",
    '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>'
  ),
  iconCalloutLightbulb: makeLucideSymbol(
    "iconCalloutLightbulb",
    '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14A4 4 0 0 0 18 10a6 6 0 0 0-12 0 4 4 0 0 0 2.91 4"/>'
  ),
  iconCalloutFire: makeLucideSymbol(
    "iconCalloutFire",
    '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'
  ),
  iconCalloutFlag: makeLucideSymbol(
    "iconCalloutFlag",
    '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>'
  ),
  iconCalloutCheckCircle: makeLucideSymbol(
    "iconCalloutCheckCircle",
    '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
  ),
  iconCalloutXCircle: makeLucideSymbol(
    "iconCalloutXCircle",
    '<circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/>'
  ),
  iconCalloutPin: makeLucideSymbol(
    "iconCalloutPin",
    '<line x1="12" x2="12" y1="17" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>'
  ),
  iconCalloutBug: makeLucideSymbol(
    "iconCalloutBug",
    '<path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3 3 0 0 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>'
  ),
  iconCalloutCode: makeLucideSymbol(
    "iconCalloutCode",
    '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'
  ),
  iconCalloutLink: makeLucideSymbol(
    "iconCalloutLink",
    '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'
  ),
  iconCalloutTarget: makeLucideSymbol(
    "iconCalloutTarget",
    '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'
  ),
  iconCalloutCalendar: makeLucideSymbol(
    "iconCalloutCalendar",
    '<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>'
  )
};
function symbolToMaskUrl(id) {
  if (!id || typeof document === "undefined")
    return null;
  const el = getSymbolElement(id);
  if (!el)
    return null;
  const viewBox = el.getAttribute("viewBox") || "0 0 24 24";
  const inner = el.innerHTML.replace(/currentColor/g, "black");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${inner}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
function getSymbolElement(id) {
  if (typeof document === "undefined" || !id)
    return null;
  const el = document.getElementById(id);
  if (!el || el.tagName.toLowerCase() !== "symbol")
    return null;
  return el;
}

// src/utils/callout_types.ts
function canonicalCalloutKey(value) {
  return normalizeCalloutLabel(value).toUpperCase();
}
function dedupeCalloutKeysCI(values) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const raw of values) {
    const trimmed = normalizeCalloutLabel(raw);
    if (!trimmed)
      continue;
    const key = canonicalCalloutKey(trimmed);
    if (seen.has(key))
      continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}
function normalizePastLabels(raw, currentLabel = "") {
  const deduped = dedupeCalloutKeysCI(Array.isArray(raw) ? raw : []);
  const labelKey = canonicalCalloutKey(currentLabel);
  if (!labelKey)
    return deduped;
  return deduped.filter((item) => canonicalCalloutKey(item) !== labelKey);
}
function getCalloutStyleSubtypes(item) {
  const seen = /* @__PURE__ */ new Set();
  const subtypes = [];
  const add = (value) => {
    const trimmed = normalizeCalloutLabel(value);
    if (!trimmed)
      return;
    const key = canonicalCalloutKey(trimmed);
    if (seen.has(key))
      return;
    seen.add(key);
    subtypes.push(trimmed);
  };
  add(item.label);
  for (const pastLabel of item.pastLabels || [])
    add(pastLabel);
  return subtypes;
}
function svgMask(paths) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
var CALLOUT_ICON_MASKS = {
  INFO: svgMask('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
  NOTE: svgMask('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  IMPORTANT: svgMask('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 8v4"/><path d="M12 16h.01"/>'),
  QUOTE: svgMask('<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2H4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2h2c0 2-1 3-3 3"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2h-4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2h2c0 2-1 3-3 3"/>'),
  TIP: svgMask('<path d="M15 14c.2-1 .7-1.7 1.5-2.5A4.9 4.9 0 0 0 18 8 6 6 0 0 0 6 8c0 1.3.4 2.5 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>'),
  WARNING: svgMask('<path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>'),
  CAUTION: svgMask('<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>'),
  QUESTION: svgMask('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>')
};
var DEFAULT_CALLOUT_ICON_MASK = CALLOUT_ICON_MASKS.NOTE;
function normalizeCalloutLabel(label) {
  return (label || "").trim();
}
function parseCalloutKeywordsInput(text) {
  return [...new Set(text.split(/[,，;；|\n]/).map((part) => part.trim()).filter(Boolean))];
}
function normalizeCalloutKeywords(raw, fallback = "") {
  if (Array.isArray(raw)) {
    const normalized = [...new Set(raw.map((part) => part.trim()).filter(Boolean))];
    if (normalized.length)
      return normalized;
  } else if (typeof raw === "string" && raw.trim()) {
    return parseCalloutKeywordsInput(raw);
  }
  const fb = (fallback || "").trim();
  return fb ? [fb] : [];
}
function formatCalloutTitleFromLabel(label) {
  const trimmed = normalizeCalloutLabel(label);
  if (!trimmed)
    return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}
var PROTECTED_CALLOUT_LABELS = /* @__PURE__ */ new Set(["NOTE", "IMPORTANT", "TIP", "WARNING", "CAUTION"]);
function isProtectedCalloutType(item) {
  return PROTECTED_CALLOUT_LABELS.has((item.label || "").trim().toUpperCase());
}
function getCalloutIconMask(label) {
  return CALLOUT_ICON_MASKS[(label || "").trim().toUpperCase()] || DEFAULT_CALLOUT_ICON_MASK;
}
function resolveCalloutIconMask(iconOrLabel, fallbackLabel = "") {
  const raw = (iconOrLabel || "").trim();
  if (raw.startsWith(SYMBOL_PREFIX)) {
    const symbolId = raw.slice(SYMBOL_PREFIX.length).trim();
    const mask = symbolToMaskUrl(symbolId);
    if (mask)
      return mask;
    return getCalloutIconMask(fallbackLabel || "");
  }
  if (raw.startsWith("url("))
    return raw;
  if (raw.startsWith("var("))
    return resolveCalloutIconMask(resolveCssVarReference(raw), fallbackLabel);
  if (raw.startsWith("data:image/svg+xml"))
    return `url("${raw}")`;
  if (raw) {
    const key = raw.toUpperCase();
    if (CALLOUT_ICON_MASKS[key])
      return CALLOUT_ICON_MASKS[key];
  }
  return getCalloutIconMask(fallbackLabel || raw);
}
function resolveCssVarReference(value) {
  if (typeof document === "undefined")
    return "";
  const match = value.match(/^var\(\s*(--[^,)]+)(?:\s*,\s*([^)]+))?\s*\)$/i);
  if (!match)
    return "";
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
var DEFAULT_CALLOUT_TYPES = [
  { id: "info", label: "Info", keywords: ["Info"], pastLabels: [], icon: getCalloutIconMask("Info"), color: "", order: 0, enabled: true },
  { id: "note", label: "NOTE", keywords: ["Note"], pastLabels: [], icon: getCalloutIconMask("NOTE"), color: "", order: 1, enabled: true },
  { id: "important", label: "IMPORTANT", keywords: ["Important"], pastLabels: [], icon: getCalloutIconMask("IMPORTANT"), color: "", order: 2, enabled: true },
  { id: "quote", label: "Quote", keywords: ["Quote"], pastLabels: [], icon: getCalloutIconMask("Quote"), color: "", order: 3, enabled: true },
  { id: "tip", label: "TIP", keywords: ["Tip"], pastLabels: [], icon: getCalloutIconMask("TIP"), color: "", order: 4, enabled: true },
  { id: "warning", label: "WARNING", keywords: ["Warning"], pastLabels: [], icon: getCalloutIconMask("WARNING"), color: "", order: 5, enabled: true },
  { id: "caution", label: "CAUTION", keywords: ["Caution"], pastLabels: [], icon: getCalloutIconMask("CAUTION"), color: "", order: 6, enabled: true },
  { id: "question", label: "Question", keywords: ["Question"], pastLabels: [], icon: getCalloutIconMask("Question"), color: "", order: 7, enabled: true }
];

// src/utils/callout_layout_vars.ts
var DEFAULT_CALLOUT_LAYOUT = {
  "--callout-shell-padding-top": "10px",
  "--callout-shell-padding-right": "0px",
  "--callout-shell-padding-bottom": "4px",
  "--callout-shell-padding-left": "12px",
  "--callout-header-width-offset": "2px",
  "--callout-header-height": "28px",
  "--callout-header-y-adjust": "-4px",
  "--callout-title-font-weight": "bold",
  "--callout-title-font-size": "12pt",
  "--callout-title-line-height": "1.2",
  "--callout-title-opacity": "1",
  "--callout-title-padding-right": "28px",
  "--callout-header-background": "var(--callout-surface-background)",
  "--callout-icon-size": "16px",
  "--callout-icon-left": "20px",
  "--callout-icon-title-gap": "2px",
  "--callout-icon-before-display": "inline-block",
  "--callout-left-accent-width": "0px",
  "--callout-body-padding-x": "10px",
  "--callout-body-padding-bottom": "12px",
  "--callout-body-gap-top": "4px",
  "--callout-body-background": "var(--callout-surface-background)",
  "--callout-border-radius": "6px",
  "--callout-border-width": "0px",
  "--callout-fold-hit-width": "40px",
  "--callout-fold-icon-size": "1.25em",
  "--callout-fold-icon-right": "0.5em",
  "--callout-fold-after-display": "block",
  "--callout-fold-duration": "180ms"
};
var CALLOUT_LAYOUT_CSS_VARS = Object.keys(DEFAULT_CALLOUT_LAYOUT);
function migrateTitleFontSize(value) {
  const trimmed = (value || "").trim();
  const percentMatch = trimmed.match(/^([\d.]+)%$/);
  if (percentMatch) {
    const pct = Number(percentMatch[1]);
    if (!Number.isNaN(pct)) {
      const pt = Math.round(pct * 12 / 100 * 10) / 10;
      return `${pt}pt`;
    }
  }
  const ptMatch = trimmed.match(/^([\d.]+)pt$/);
  if (ptMatch)
    return trimmed;
  return DEFAULT_CALLOUT_LAYOUT["--callout-title-font-size"];
}
function normalizeCalloutLayout(raw) {
  const merged = { ...DEFAULT_CALLOUT_LAYOUT };
  if (!raw)
    return merged;
  Object.entries(raw).forEach(([key, value]) => {
    const trimmed = (value || "").trim();
    if (trimmed && key in DEFAULT_CALLOUT_LAYOUT) {
      merged[key] = key === "--callout-title-font-size" ? migrateTitleFontSize(trimmed) : trimmed;
    }
  });
  return merged;
}

// src/utils/settings_schema_migration.ts
var SETTINGS_SCHEMA_VERSION = 6;
var MIN_SETTINGS_SCHEMA_VERSION = 2;
var DEFAULT_APPEARANCE_PRESET_ID = "default";
function isRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function cloneRaw(value) {
  if (value === null || value === void 0)
    return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}
function coerceSchemaVersion(raw) {
  if (!raw)
    return SETTINGS_SCHEMA_VERSION;
  const parsed = Number(raw.schemaVersion);
  if (Number.isFinite(parsed) && parsed >= 1) {
    return Math.floor(parsed);
  }
  if (Array.isArray(raw.callouts) && raw.callouts.length > 0) {
    return MIN_SETTINGS_SCHEMA_VERSION;
  }
  return SETTINGS_SCHEMA_VERSION;
}
function migrateLegacyCalloutFields(source, index, defaults) {
  var _a, _b;
  if (Array.isArray(source.keywords)) {
    const next2 = { ...source };
    delete next2.keyword;
    return next2;
  }
  const oldSubtype = typeof source.keyword === "string" ? source.keyword.trim() : "";
  const oldDisplay = typeof source.label === "string" ? source.label.trim() : "";
  const defaultItem = defaults[index];
  const next = { ...source };
  delete next.keyword;
  if (oldSubtype) {
    const keywords = normalizeCalloutKeywords(
      oldDisplay && oldDisplay.toUpperCase() !== oldSubtype.toUpperCase() ? oldDisplay : "",
      oldDisplay || formatCalloutTitleFromLabel(oldSubtype) || oldSubtype
    );
    next.label = oldSubtype || (defaultItem == null ? void 0 : defaultItem.label) || "";
    next.keywords = keywords.length ? keywords : normalizeCalloutKeywords("", ((_a = defaultItem == null ? void 0 : defaultItem.keywords) == null ? void 0 : _a[0]) || oldSubtype);
    return next;
  }
  next.label = oldDisplay || (defaultItem == null ? void 0 : defaultItem.label) || "";
  next.keywords = normalizeCalloutKeywords(
    void 0,
    oldDisplay || ((_b = defaultItem == null ? void 0 : defaultItem.keywords) == null ? void 0 : _b[0]) || ""
  );
  return next;
}
function migrateCalloutList(rawCallouts) {
  const defaults = DEFAULT_CALLOUT_TYPES;
  const list = Array.isArray(rawCallouts) ? rawCallouts : [];
  return list.map((item, index) => {
    var _a, _b, _c;
    const source = isRecord(item) ? item : {};
    const migrated = migrateLegacyCalloutFields(source, index, defaults);
    const label = normalizeCalloutLabel(String(migrated.label || ((_a = defaults[index]) == null ? void 0 : _a.label) || ""));
    const keywords = normalizeCalloutKeywords(
      migrated.keywords,
      ((_c = (_b = defaults[index]) == null ? void 0 : _b.keywords) == null ? void 0 : _c[0]) || formatCalloutTitleFromLabel(label) || label
    );
    const pastLabels = normalizePastLabels(
      Array.isArray(migrated.pastLabels) ? migrated.pastLabels : Array.isArray(migrated.historicalLabels) ? migrated.historicalLabels : [],
      label
    );
    const next = {
      ...migrated,
      label,
      keywords,
      pastLabels
    };
    delete next.historicalLabels;
    return next;
  });
}
function migrateSettingsV2ToV5(raw) {
  const layout = isRecord(raw.layout) ? raw.layout : normalizeCalloutLayout();
  return {
    ...raw,
    schemaVersion: 5,
    callouts: migrateCalloutList(raw.callouts),
    layout,
    appearancePresets: Array.isArray(raw.appearancePresets) ? raw.appearancePresets : [],
    activeAppearancePresetId: typeof raw.activeAppearancePresetId === "string" ? raw.activeAppearancePresetId : DEFAULT_APPEARANCE_PRESET_ID,
    debugLogEnabled: typeof raw.debugLogEnabled === "boolean" ? raw.debugLogEnabled : false
  };
}
function migrateSettingsV5ToV6(raw) {
  return {
    ...raw,
    schemaVersion: 6,
    calloutTombstone: Array.isArray(raw.calloutTombstone) ? raw.calloutTombstone : [],
    callouts: migrateCalloutList(raw.callouts)
  };
}
function patchV6HistoricalLabels(raw) {
  if (!Array.isArray(raw.callouts)) {
    return { raw, patched: false };
  }
  let patched = false;
  const callouts = raw.callouts.map((item) => {
    if (!isRecord(item) || !("historicalLabels" in item))
      return item;
    patched = true;
    const legacy = item;
    const label = normalizeCalloutLabel(String(legacy.label || ""));
    const pastLabels = normalizePastLabels(
      Array.isArray(legacy.pastLabels) && legacy.pastLabels.length ? legacy.pastLabels : legacy.historicalLabels,
      label
    );
    const next = { ...legacy, pastLabels };
    delete next.historicalLabels;
    return next;
  });
  return patched ? { raw: { ...raw, callouts }, patched: true } : { raw, patched: false };
}
function migrateCalloutSettings(raw) {
  if (!isRecord(raw)) {
    return {
      settings: {},
      migrated: false,
      fromVersion: SETTINGS_SCHEMA_VERSION,
      toVersion: SETTINGS_SCHEMA_VERSION
    };
  }
  const fromVersion = coerceSchemaVersion(raw);
  let working = cloneRaw(raw);
  let migrated = false;
  if (fromVersion > SETTINGS_SCHEMA_VERSION) {
    working.schemaVersion = SETTINGS_SCHEMA_VERSION;
    migrated = true;
  }
  let version = Math.min(fromVersion, SETTINGS_SCHEMA_VERSION);
  if (version < 5) {
    working = migrateSettingsV2ToV5(working);
    version = 5;
    migrated = true;
  }
  if (version < 6) {
    working = migrateSettingsV5ToV6(working);
    version = 6;
    migrated = true;
  }
  const historicalPatch = patchV6HistoricalLabels(working);
  working = historicalPatch.raw;
  if (historicalPatch.patched)
    migrated = true;
  if (working.schemaVersion !== SETTINGS_SCHEMA_VERSION) {
    working.schemaVersion = SETTINGS_SCHEMA_VERSION;
    migrated = true;
  }
  return {
    settings: working,
    migrated,
    fromVersion,
    toVersion: SETTINGS_SCHEMA_VERSION
  };
}

// src/utils/callout_resolver.ts
function getAllResolvedCalloutTypes(settings) {
  return normalizeCalloutSettings(settings).callouts;
}

// src/utils/settings.ts
var DEFAULT_APPEARANCE_PRESET_ID2 = "default";
var DEFAULT_APPEARANCE_PRESET_NAME = "Default";
function getBuiltinDefaultAppearanceLayout() {
  return normalizeCalloutLayout();
}
function fixDefaultAppearancePreset(preset) {
  if (preset.id !== DEFAULT_APPEARANCE_PRESET_ID2)
    return preset;
  return {
    id: DEFAULT_APPEARANCE_PRESET_ID2,
    name: DEFAULT_APPEARANCE_PRESET_NAME,
    layout: getBuiltinDefaultAppearanceLayout()
  };
}
function ensureDefaultAppearancePreset(presets) {
  const others = presets.filter((item) => item.id !== DEFAULT_APPEARANCE_PRESET_ID2).map((item) => ({
    ...item,
    layout: normalizeCalloutLayout(item.layout)
  }));
  return [fixDefaultAppearancePreset({
    id: DEFAULT_APPEARANCE_PRESET_ID2,
    name: DEFAULT_APPEARANCE_PRESET_NAME,
    layout: getBuiltinDefaultAppearanceLayout()
  }), ...others];
}
function normalizeColor(color) {
  return (color || "").trim();
}
function makeId(label, fallbackIndex) {
  const raw = normalizeCalloutLabel(label);
  if (raw)
    return raw.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  return `callout-${fallbackIndex + 1}`;
}
function makePresetId(name, existingIds) {
  const base = (name || "preset").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-") || "preset";
  let id = base;
  let index = 1;
  while (existingIds.includes(id)) {
    id = `${base}-${index++}`;
  }
  return id;
}
function normalizeType(item, index, defaults) {
  var _a;
  const source = item ?? {};
  const defaultItem = defaults[index];
  const label = normalizeCalloutLabel(source.label || (defaultItem == null ? void 0 : defaultItem.label) || "");
  const keywords = normalizeCalloutKeywords(
    source.keywords,
    ((_a = defaultItem == null ? void 0 : defaultItem.keywords) == null ? void 0 : _a[0]) || formatCalloutTitleFromLabel(label) || label
  );
  const icon = (source.icon || (defaultItem == null ? void 0 : defaultItem.icon) || "").trim();
  const color = normalizeColor(source.color || (defaultItem == null ? void 0 : defaultItem.color) || "");
  const draft = {
    id: (source.id || makeId(label, index)).trim(),
    label,
    keywords,
    pastLabels: normalizePastLabels(source.pastLabels, label),
    icon,
    color,
    order: Number.isFinite(Number(source.order)) ? Number(source.order) : index,
    enabled: source.enabled !== false
  };
  if (isProtectedCalloutType(draft)) {
    draft.pastLabels = [];
  }
  return draft;
}
function normalizeCalloutTombstone(raw) {
  return dedupeCalloutKeysCI(Array.isArray(raw) ? raw : []);
}
function normalizeAppearancePresets(raw) {
  const rawList = Array.isArray(raw) ? raw : [];
  const usedIds = [DEFAULT_APPEARANCE_PRESET_ID2];
  const presets = rawList.filter((item) => (item == null ? void 0 : item.id) !== DEFAULT_APPEARANCE_PRESET_ID2).map((item, index) => {
    const name = ((item == null ? void 0 : item.name) || "").trim() || `Preset ${index + 1}`;
    const id = ((item == null ? void 0 : item.id) || "").trim() || makePresetId(name, usedIds);
    usedIds.push(id);
    return {
      id,
      name,
      layout: normalizeCalloutLayout(item == null ? void 0 : item.layout)
    };
  }).filter((item) => item.name);
  return ensureDefaultAppearancePreset(presets);
}
function createDefaultCalloutSettings() {
  const layout = normalizeCalloutLayout();
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    callouts: DEFAULT_CALLOUT_TYPES.map((item, index) => ({
      ...item,
      id: makeId(item.label, index),
      order: index
    })),
    layout,
    appearancePresets: ensureDefaultAppearancePreset([]),
    activeAppearancePresetId: DEFAULT_APPEARANCE_PRESET_ID2,
    calloutTombstone: [],
    debugLogEnabled: false
  };
}
function normalizeCalloutSettings(raw) {
  return prepareCalloutSettings(raw).settings;
}
function prepareCalloutSettings(raw) {
  const migration = migrateCalloutSettings(raw);
  return {
    settings: normalizeCalloutSettingsCore(migration.settings),
    migrated: migration.migrated,
    fromVersion: migration.fromVersion
  };
}
function normalizeCalloutSettingsCore(raw) {
  const defaults = createDefaultCalloutSettings();
  const rawList = Array.isArray(raw == null ? void 0 : raw.callouts) ? raw.callouts : [];
  const callouts = rawList.length > 0 ? rawList : defaults.callouts;
  const normalized = callouts.map((item, index) => normalizeType(item, index, defaults.callouts));
  normalized.sort((a, b) => a.order - b.order);
  normalized.forEach((item, index) => {
    item.order = index;
    if (!item.id)
      item.id = makeId(item.label || item.keywords[0] || "", index);
    if (!item.label && item.keywords.length === 1) {
      item.label = item.keywords[0];
    }
    if (!item.keywords.length) {
      item.keywords = normalizeCalloutKeywords("", formatCalloutTitleFromLabel(item.label) || item.label);
    }
  });
  const layoutFromRaw = (raw == null ? void 0 : raw.layout) ? normalizeCalloutLayout(raw.layout) : null;
  const presets = normalizeAppearancePresets(raw == null ? void 0 : raw.appearancePresets);
  const requestedActiveId = ((raw == null ? void 0 : raw.activeAppearancePresetId) || "").trim();
  const activeAppearancePresetId = presets.some((item) => item.id === requestedActiveId) ? requestedActiveId : DEFAULT_APPEARANCE_PRESET_ID2;
  const activePreset = presets.find((item) => item.id === activeAppearancePresetId);
  const layout = layoutFromRaw || normalizeCalloutLayout(activePreset == null ? void 0 : activePreset.layout);
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    callouts: normalized,
    calloutTombstone: normalizeCalloutTombstone(raw == null ? void 0 : raw.calloutTombstone),
    layout,
    appearancePresets: presets.map((preset) => {
      if (preset.id === DEFAULT_APPEARANCE_PRESET_ID2) {
        return fixDefaultAppearancePreset(preset);
      }
      if (preset.id === activeAppearancePresetId) {
        return { ...preset, layout };
      }
      return preset;
    }),
    activeAppearancePresetId,
    debugLogEnabled: typeof (raw == null ? void 0 : raw.debugLogEnabled) === "boolean" ? raw.debugLogEnabled : defaults.debugLogEnabled
  };
}

// src/utils/callout_dynamic_styles.ts
var BUILTIN_LABEL_COLOR_VAR = {
  info: "--callout-color-info",
  note: "--callout-color-default",
  tip: "--callout-color-tip",
  quote: "--callout-color-quote",
  question: "--callout-color-question",
  important: "--callout-color-important",
  warning: "--callout-color-warning",
  caution: "--callout-color-caution"
};
function escapeCssString(value) {
  return (value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n|\r|\f/g, "");
}
function safeCssValue(value) {
  const trimmed = (value || "").trim();
  if (/^url\(/i.test(trimmed)) {
    return trimmed.replace(/[{}\n\r\f]/g, "");
  }
  return trimmed.replace(/[;{}\n\r\f]/g, "");
}
function isValidCssColor(value) {
  var _a;
  if (!value)
    return false;
  if (typeof window === "undefined" || !((_a = window.CSS) == null ? void 0 : _a.supports))
    return true;
  return CSS.supports("color", value);
}
function resolveBuiltinColorVarForLabel(label) {
  const key = normalizeCalloutLabel(label).toLowerCase();
  return BUILTIN_LABEL_COLOR_VAR[key] || "--callout-color-default";
}
function resolveCalloutTypeColorValue(item) {
  const custom = safeCssValue(item.color || "");
  if (custom && isValidCssColor(custom)) {
    return custom;
  }
  return `var(${resolveBuiltinColorVarForLabel(item.label)})`;
}
function buildCalloutTypeAppearanceStylesheet(settings) {
  const rules = [];
  getAllResolvedCalloutTypes(settings).forEach((item) => {
    const subtypes = getCalloutStyleSubtypes(item);
    if (!subtypes.length)
      return;
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
function buildDefaultCalloutTypesStylesheet() {
  return buildCalloutTypeAppearanceStylesheet(createDefaultCalloutSettings());
}

// scripts/generate-callout-defaults-entry.ts
var header = "/* Generated by scripts/generate-callout-defaults.cjs \u2014 do not edit */\n";
var css = buildDefaultCalloutTypesStylesheet();
var outFile = path.join(__dirname, "../src/callout_defaults.css");
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, header + css + (css.endsWith("\n") ? "" : "\n"), "utf8");
