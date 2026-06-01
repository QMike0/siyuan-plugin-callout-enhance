import { Dialog } from "siyuan";
import type { CleanupProgress, CleanupResult } from "../utils/migration";
import { t } from "../utils/i18n";

export function formatTombstoneReclaimConfirmMessage(options: {
    reclaimedLabel: string;
    newTypeTitle: string;
    count: number;
}) {
    const { reclaimedLabel, newTypeTitle, count } = options;
    if (count > 0) {
        return t("tombstoneReclaimMessageWithCount", { count, reclaimedLabel, newTypeTitle });
    }
    return t("tombstoneReclaimMessage", { reclaimedLabel, newTypeTitle });
}

export function formatCleanupResultMessage(result: CleanupResult) {
    const status = result.aborted ? t("cleanupStopped") : t("cleanupFinished");
    const summary = t("cleanupSummary", {
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
    });
    if (!result.errors.length) {
        return `${status} ${summary}`;
    }
    const detail = result.errors.slice(0, 3).map((entry) => `${entry.id}: ${entry.reason}`).join("; ");
    const more = result.errors.length > 3 ? t("cleanupErrorsMore", { count: result.errors.length - 3 }) : "";
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
        title: t("cleanupProgressTitle"),
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
    cancelBtn.textContent = t("cancel");

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
        cancelBtn.textContent = t("close");
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
    if (count > 0) {
        return t("deleteCalloutTypeMessageWithCount", { count, title });
    }
    return t("deleteCalloutTypeMessage", { title });
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
    return createHelpIcon(t("helpPreview"), extraClass);
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
        confirmLabel = t("confirm"),
        cancelLabel = t("cancel"),
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
