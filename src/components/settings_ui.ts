import { Dialog } from "siyuan";

export const PREVIEW_HELP_TOOLTIP = "Default-theme preview only. See the editor for theme-specific results.";

export const LABEL_HELP_TOOLTIP = "Unique type ID written to [!LABEL] and used for styling. Must not duplicate another type (case-insensitive).";

export const KEYWORDS_HELP_TOOLTIP = "Aliases for search and completion only; not written to the document. Separate multiple entries with commas or semicolons.";

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
};

export function openConfirmDialog(options: ConfirmDialogOptions) {
    const {
        title,
        message,
        confirmLabel = "Confirm",
        cancelLabel = "Cancel",
        width = window.innerWidth < 768 ? "88vw" : "360px",
        onConfirm,
    } = options;

    const dialog = new Dialog({
        title,
        width,
        content: `<div class="callout-enhance-confirm-body"></div>`,
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
    cancelBtn.addEventListener("click", () => dialog.destroy());

    footer.append(confirmBtn, cancelBtn);
    body.append(messageEl, footer);
    return dialog;
}
