import { Dialog } from "siyuan";
import type { CleanupProgress, CleanupResult } from "../utils/migration";
import { dialogWidth, isMobileUi } from "../utils/env";
import { t } from "../utils/i18n";
import { warnLog } from "../utils/logger";

/** Mark a plugin dialog so mobile CSS can tighten layout without touching desktop. */
export function decoratePluginDialog(dialog: Dialog, className?: string) {
    const container = dialog.element.querySelector(".b3-dialog__container");
    if (!container) return;
    if (className) container.classList.add(className);
    if (isMobileUi()) {
        container.classList.add("callout-enhance-dialog--mobile");
        if (className) container.classList.add(`${className}--mobile`);
    }
}

export type CleanupStartMode = "snapshot-then-cleanup" | "cleanup-only";

export function formatTombstoneReclaimConfirmMessage(options: {
    reclaimedLabel: string;
    newTypeTitle: string;
    countKnown: boolean;
    count: number;
}) {
    const { reclaimedLabel, newTypeTitle, countKnown, count } = options;
    if (!countKnown) {
        return t("tombstoneReclaimMessageCountUnknown", { reclaimedLabel, newTypeTitle });
    }
    if (count > 0) {
        return t("tombstoneReclaimMessageWithCount", { count, reclaimedLabel, newTypeTitle });
    }
    return t("tombstoneReclaimMessage", { reclaimedLabel, newTypeTitle });
}

export function logCleanupErrorsToConsole(result: CleanupResult) {
    if (!result.errors.length) return;
    warnLog(`[Callout Enhance] Cleanup errors (${result.errors.length}):`);
    for (const entry of result.errors) {
        const mapping = entry.fromLabel && entry.toLabel
            ? `${entry.fromLabel} -> ${entry.toLabel}`
            : "";
        const phase = entry.phase ? `phase ${entry.phase}` : "";
        const context = [phase, mapping].filter(Boolean).join(", ");
        warnLog(`  - ${entry.id}: ${entry.reason}${context ? ` (${context})` : ""}`);
    }
}

export function formatCleanupResultMessage(result: CleanupResult) {
    const status = result.aborted ? t("cleanupStopped") : t("cleanupFinished");
    const summary = t("cleanupSummary", {
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
    });
    const parts = [`${status} ${summary}`];
    if (!result.aborted && !result.metadataCleared) {
        parts.push(result.metadataPartiallyCleared
            ? t("cleanupMetadataPartiallyRetained")
            : t("cleanupMetadataRetained"));
    }
    if (!result.errors.length) {
        return parts.join(" ");
    }
    const detail = result.errors.slice(0, 3).map((entry) => `${entry.id}: ${entry.reason}`).join("; ");
    const more = result.errors.length > 3 ? t("cleanupErrorsMore", { count: result.errors.length - 3 }) : "";
    parts.push(`${detail}${more}`);
    parts.push(t("cleanupErrorsConsoleHint"));
    return parts.join(" ");
}

export function formatCleanupForceClearMessage(result: CleanupResult) {
    const reasons: string[] = [];
    if (result.failed > 0) {
        reasons.push(t("cleanupForceClearReasonFailed", { count: result.failed }));
    }
    if (result.indexTimedOut) {
        reasons.push(t("cleanupForceClearReasonIndexTimeout"));
    }
    const reasonText = reasons.join(t("cleanupForceClearReasonJoin"));
    return t("cleanupForceClearMessage", { reasons: reasonText });
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
    onFinishedClose?: (result: CleanupResult) => void;
}): CleanupProgressDialogHandle {
    const { signal, onCancel, onFinishedClose } = options;

    const dialog = new Dialog({
        title: t("cleanupProgressTitle"),
        width: dialogWidth("480px"),
        disableClose: true,
        content: "<div class=\"callout-enhance-cleanup-progress\"></div>",
    });
    decoratePluginDialog(dialog);
    bindDialogModalDismiss(dialog);

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
    let lastResult: CleanupResult | null = null;
    cancelBtn.addEventListener("click", () => {
        if (finished) {
            const result = lastResult;
            dialog.destroy();
            if (result) onFinishedClose?.(result);
            return;
        }
        onCancel();
    });

    const showResult = (result: CleanupResult) => {
        finished = true;
        lastResult = result;
        logCleanupErrorsToConsole(result);
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

export function formatDeleteCalloutTypeMessage(options: { title: string; countKnown: boolean; count: number }) {
    const { title, countKnown, count } = options;
    if (!countKnown) {
        return t("deleteCalloutTypeMessageCountUnknown", { title });
    }
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

/** Block scrim / header close; user must use in-dialog buttons. */
export function bindDialogModalDismiss(dialog: Dialog) {
    dialog.element.querySelector(".b3-dialog__close")?.classList.add("fn__none");
    dialog.element.querySelector(".b3-dialog__scrim")?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
    });
    dialog.element.querySelector(".b3-dialog__close")?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
    });
}

export type ConfirmDialogOptions = {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    width?: string;
    /** When true, only footer buttons can dismiss the dialog. */
    disableClose?: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
};

export function openConfirmDialog(options: ConfirmDialogOptions) {
    const {
        title,
        message,
        confirmLabel = t("confirm"),
        cancelLabel = t("cancel"),
        width = dialogWidth("360px", "88vw"),
        disableClose = false,
        onConfirm,
        onCancel,
    } = options;

    const dialog = new Dialog({
        title,
        width,
        disableClose,
        content: "<div class=\"callout-enhance-confirm-body\"></div>",
    });
    decoratePluginDialog(dialog);
    if (disableClose) {
        bindDialogModalDismiss(dialog);
    }

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

export function openCleanupStartConfirmDialog(options: {
    title: string;
    message: string;
    width?: string;
    onSnapshotThenCleanup: () => void;
    onCleanupOnly: () => void;
    onCancel?: () => void;
}) {
    const {
        title,
        message,
        width = dialogWidth("480px"),
        onSnapshotThenCleanup,
        onCleanupOnly,
        onCancel,
    } = options;

    const dialog = new Dialog({
        title,
        width,
        content: "<div class=\"callout-enhance-confirm-body\"></div>",
    });
    decoratePluginDialog(dialog);

    const body = dialog.element.querySelector(".callout-enhance-confirm-body") as HTMLElement | null;
    if (!body) return dialog;

    const messageEl = document.createElement("div");
    messageEl.className = "b3-label__text callout-enhance-confirm-body__message";
    messageEl.textContent = message;

    const footer = document.createElement("div");
    footer.className = "b3-dialog__action callout-enhance-dialog-footer callout-enhance-cleanup-start-footer";

    const snapshotBtn = document.createElement("button");
    snapshotBtn.className = "b3-button b3-button--text";
    snapshotBtn.type = "button";
    snapshotBtn.textContent = t("cleanupStartWithSnapshot");
    snapshotBtn.addEventListener("click", () => {
        onSnapshotThenCleanup();
        dialog.destroy();
    });

    const cleanupBtn = document.createElement("button");
    cleanupBtn.className = "b3-button b3-button--outline";
    cleanupBtn.type = "button";
    cleanupBtn.textContent = t("cleanupStartWithoutSnapshot");
    cleanupBtn.addEventListener("click", () => {
        onCleanupOnly();
        dialog.destroy();
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "b3-button b3-button--cancel";
    cancelBtn.type = "button";
    cancelBtn.textContent = t("cancel");
    cancelBtn.addEventListener("click", () => {
        onCancel?.();
        dialog.destroy();
    });

    footer.append(snapshotBtn, cleanupBtn, cancelBtn);
    body.append(messageEl, footer);
    return dialog;
}

export function openSnapshotFailedContinueDialog(options: {
    reason: string;
    onContinue: () => void;
    onCancel?: () => void;
}) {
    const message = t("cleanupSnapshotFailedContinue", { reason: options.reason });
    return openConfirmDialog({
        title: t("cleanupSnapshotFailedTitle"),
        message,
        confirmLabel: t("cleanupContinueWithoutSnapshot"),
        cancelLabel: t("cancel"),
        width: dialogWidth("440px"),
        disableClose: true,
        onConfirm: options.onContinue,
        onCancel: options.onCancel,
    });
}
