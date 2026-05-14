/**
 * Text normalization helpers for callout title editing.
 *
 * This module keeps title text canonical by removing invisible characters,
 * normalizing whitespace, and trimming edge spaces.
 */
export function normalizeCalloutTitleText(text: string) {
    return (text || "")
        .replace(/\u00A0/g, " ")
        .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}
