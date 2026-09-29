/**
 * Ensures callout titles carry the same editable attributes SiYuan uses
 * natively since v3.8.2. Input, paste, shortcuts, and persistence stay with
 * the editor; this only repairs older documents that were saved without them.
 */
import { isPublishService } from "../core/cl_api";

function editorSpellcheckEnabled() {
    return !!(window as Window & { siyuan?: { config?: { editor?: { spellcheck?: boolean } } } }).siyuan?.config?.editor?.spellcheck;
}

export function ensureCalloutTitleEditable(titleEl: HTMLElement | null) {
    if (!titleEl) return;
    if (isPublishService()) {
        titleEl.contentEditable = "false";
        titleEl.removeAttribute("contenteditable");
        return;
    }
    titleEl.contentEditable = "true";
    titleEl.spellcheck = editorSpellcheckEnabled();
}
