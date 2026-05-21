let debugEnabled = false;

export function setDebugEnabled(enabled: boolean) {
    debugEnabled = !!enabled;
}

export function debugLog(...args: any[]) {
    if (!debugEnabled) return;
    console.log("[CalloutEnhance]", ...args);
}

export function warnLog(...args: any[]) {
    console.warn(...args);
}

export function errorLog(...args: any[]) {
    console.error(...args);
}
