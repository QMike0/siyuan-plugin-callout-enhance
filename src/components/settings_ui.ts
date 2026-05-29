import { Dialog } from "siyuan";
import type { CleanupProgress, CleanupResult } from "../utils/migration";

export const PREVIEW_HELP_TOOLTIP = "Default-theme preview only. See the editor for theme-specific results.";

export const LABEL_HELP_TOOLTIP = "Unique type ID written to [!LABEL] and used for styling. Must not duplicate another type (case-insensitive).";

export const KEYWORDS_HELP_TOOLTIP = "Aliases for search and completion only; not written to the document. Separate multiple entries with commas or semicolons.";

export const HISTORICAL_LABEL_HELP_TOOLTIP = "Past labels kept after a rename. Used for styling and settings search only; not used for completion or written to new blocks.";

export function formatTombstoneReclaimConfirmMessage(options: {
    reclaimedLabel: string;
    newTypeTitle: string;
    count: number;
}) {
    const { reclaimedLabel, newTypeTitle, count } = options;
    const countLine = count > 0
        ? `About ${count} callout block(s) in open or indexed notebooks still use that name with the default style. `
        : "";
    return `${countLine}A deleted type previously used "${reclaimedLabel}". After saving, blocks can use the current type "${newTypeTitle}". To keep the default style instead, run "Clean up legacy data" on the About tab before reusing this name.`;
}

export const CLEANUP_CONFIRM_MESSAGE = "This may take a long time. Save all open documents first (unsaved editor buffers are not in the database and will be skipped). Current Callout Types edits in this dialog are included. Keep SiYuan and this settings window open until cleanup finishes.";

export function formatCleanupResultMessage(result: CleanupResult) {
    const status = result.aborted ? "Cleanup stopped." : "Cleanup finished.";
    const summary = `Processed ${result.processed}, updated ${result.succeeded}, failed ${result.failed}.`;
    if (!result.errors.length) {
        return `${status} ${summary}`;
    }
    const detail = result.errors.slice(0, 3).map((entry) => `${entry.id}: ${entry.reason}`).join("; ");
    const more = result.errors.length > 3 ? ` (+${result.errors.length - 3} more)` : "";
    return `${status} ${summary} ${detail}${more}`;
}

export type CleanupProgressDialogHandle = {
    dialog: Dialog;
    update: (progress: CleanupProgress) => void;
    showResult: (result: CleanupResult) => void;
    close: () => void;
};

export function openCleanupProgressDialog(options: {
    signal: AbortSignal;
    onCancel: () => void;
}): CleanupProgressDialogHandle {
    const { signal, onCancel } = options;

    const dialog = new Dialog({
        title: "Clean up legacy data",
        width: window.innerWidth < 768 ? "92vw" : "480px",
        disableClose: true,
        content: "<div class=\"callout-enhance-cleanup-progress\"></div>",
    });

    const root = dialog.element.querySelector(".callout-enhance-cleanup-progress") as HTMLElement | null;
    if (!root) {
        return {
            dialog,
            update: () => undefined,
            showResult: () => undefined,
            close: () => dialog.destroy(),
        };
    }

    const messageEl = document.createElement("div");
    messageEl.className = "b3-label__text callout-enhance-cleanup-progress__message";

    const progressTrack = document.createElement("div");
    progressTrack.className = "callout-enhance-cleanup-progress__track";
    const progressBar = document.createElement("div");
    progressBar.className = "callout-enhance-cleanup-progress__bar";
    progressTrack.append(progressBar);

    const footer = document.createElement("div");
    footer.className = "b3-dialog__action callout-enhance-dialog-footer";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "b3-button b3-button--cancel";
    cancelBtn.type = "button";
    cancelBtn.textContent = "Cancel";

    footer.append(cancelBtn);
    root.append(messageEl, progressTrack, footer);

    const update = (progress: CleanupProgress) => {
        messageEl.textContent = progress.message;
        if (progress.indeterminate || progress.percent === undefined) {
            progressTrack.classList.add("callout-enhance-cleanup-progress__track--indeterminate");
            progressBar.style.width = "";
        } else {
            progressTrack.classList.remove("callout-enhance-cleanup-progress__track--indeterminate");
            progressBar.style.width = `${Math.max(0, Math.min(100, progress.percent))}%`;
        }
    };

    let finished = false;
    cancelBtn.addEventListener("click", () => {
        if (finished) {
            dialog.destroy();
            return;
        }
        onCancel();
    });

    const showResult = (result: CleanupResult) => {
        finished = true;
        progressTrack.classList.remove("callout-enhance-cleanup-progress__track--indeterminate");
        progressBar.style.width = result.aborted ? "" : "100%";
        messageEl.textContent = formatCleanupResultMessage(result);
        cancelBtn.disabled = false;
        cancelBtn.textContent = "Close";
        cancelBtn.classList.remove("b3-button--cancel");
        cancelBtn.classList.add("b3-button--text");
    };

    signal.addEventListener("abort", () => {
        cancelBtn.disabled = true;
    }, { once: true });

    return {
        dialog,
        update,
        showResult,
        close: () => dialog.destroy(),
    };
}

export function formatDeleteCalloutTypeMessage(options: { title: string; count: number }) {
    const { title, count } = options;
    const countLine = count > 0
        ? `At least ${count} callout block(s) use this type (open or indexed notebooks only). `
        : "";
    return `${countLine}Delete "${title}"? Blocks keep their subtype but lose custom styling. This cannot be undone.`;
}

export function createHelpIcon(tooltip: string, extraClass = "") {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("width", "14");
    icon.setAttribute("height", "14");
    icon.setAttribute("data-position", "north");
    icon.setAttribute("aria-label", tooltip);
    icon.classList.add("callout-enhance-field-help", "ariaLabel", ...extraClass.split(" ").filter(Boolean));
    icon.innerHTML = `
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"></circle>
        <path d="M9.5 9.5a2.5 2.5 0 0 1 4.8 1 2 2 0 0 1-2.4 2.1c-.8.2-1.4.8-1.4 1.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
        <circle cx="12" cy="17.2" r="0.9" fill="currentColor"></circle>
    `;
    return icon;
}

export function createPreviewHelpIcon(extraClass = "") {
    return createHelpIcon(PREVIEW_HELP_TOOLTIP, extraClass);
}

export type ConfirmDialogOptions = {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    width?: string;
    onConfirm: () => void;
    onCancel?: () => void;
};

export function openConfirmDialog(options: ConfirmDialogOptions) {
    const {
        title,
        message,
        confirmLabel = "Confirm",
        cancelLabel = "Cancel",
        width = window.innerWidth < 768 ? "88vw" : "360px",
        onConfirm,
        onCancel,
    } = options;

    const dialog = new Dialog({
        title,
        width,
        content: "<div class=\"callout-enhance-confirm-body\"></div>",
    });

    const body = dialog.element.querySelector(".callout-enhance-confirm-body") as HTMLElement | null;
    if (!body) return dialog;

    const messageEl = document.createElement("div");
    messageEl.className = "b3-label__text callout-enhance-confirm-body__message";
    messageEl.textContent = message;

    const footer = document.createElement("div");
    footer.className = "b3-dialog__action callout-enhance-dialog-footer";

    const confirmBtn = document.createElement("button");
    confirmBtn.className = "b3-button b3-button--text";
    confirmBtn.type = "button";
    confirmBtn.textContent = confirmLabel;
    confirmBtn.addEventListener("click", () => {
        onConfirm();
        dialog.destroy();
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "b3-button b3-button--cancel";
    cancelBtn.type = "button";
    cancelBtn.textContent = cancelLabel;
    cancelBtn.addEventListener("click", () => {
        onCancel?.();
        dialog.destroy();
    });

    footer.append(confirmBtn, cancelBtn);
    body.append(messageEl, footer);
    return dialog;
}
