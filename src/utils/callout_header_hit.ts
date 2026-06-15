import {
    CalloutLayoutVarName,
    DEFAULT_CALLOUT_LAYOUT,
    resolveCalloutLayoutLength,
} from "./callout_layout_vars";

/** Vertical slack below the title row when testing header clicks (icon / fold / title). */
const HEADER_HIT_EXTRA_BOTTOM = 8;

export type CalloutHeaderHitAreas = {
    typeMenuLeft: number;
    typeMenuRight: number;
    headerHeight: number;
    foldButtonLeft: number;
    foldButtonRight: number;
};

function resolveLayoutLengthPx(styles: CSSStyleDeclaration, varName: CalloutLayoutVarName): number {
    const raw = styles.getPropertyValue(varName).trim() || DEFAULT_CALLOUT_LAYOUT[varName] || "";
    const num = parseFloat(raw);
    if (!Number.isFinite(num)) {
        return resolveCalloutLayoutLength(styles, varName);
    }
    if (raw.endsWith("em")) {
        const fontSize = parseFloat(styles.fontSize);
        return num * (Number.isFinite(fontSize) ? fontSize : 16);
    }
    if (raw.endsWith("pt")) {
        return num * (96 / 72);
    }
    return num;
}

/**
 * Header click-hit geometry for a callout block (coordinates relative to the block border box).
 */
export function getCalloutHeaderHitAreas(block: HTMLElement): CalloutHeaderHitAreas {
    const styles = getComputedStyle(block);
    const iconLeft = resolveCalloutLayoutLength(styles, "--callout-icon-left");
    const headerXShift = resolveCalloutLayoutLength(styles, "--callout-header-width-offset", "--callout-header-x-shift");
    const iconSize = resolveCalloutLayoutLength(styles, "--callout-icon-size");
    const titleRowHeight = resolveCalloutLayoutLength(styles, "--callout-header-height", "--callout-title-row-height");
    const shellPaddingTop = resolveCalloutLayoutLength(styles, "--callout-shell-padding-top");

    const iconCenterX = iconLeft + headerXShift + iconSize / 2;
    const typeMenuHalfWidth = Math.max(12, iconSize * 0.7);
    const typeMenuLeft = Math.max(0, iconCenterX - typeMenuHalfWidth);
    const typeMenuRight = iconCenterX + typeMenuHalfWidth;
    const headerHeight = shellPaddingTop + titleRowHeight + HEADER_HIT_EXTRA_BOTTOM;

    const foldVisible = styles.getPropertyValue("--callout-fold-after-display").trim() !== "none";
    let foldButtonLeft = 0;
    let foldButtonRight = 0;

    if (foldVisible) {
        const foldHitWidth = resolveCalloutLayoutLength(styles, "--callout-fold-hit-width");
        const foldIconRight = resolveLayoutLengthPx(styles, "--callout-fold-icon-right");
        const foldIconSize = resolveLayoutLengthPx(styles, "--callout-fold-icon-size");

        const infoEl = block.querySelector(".callout-info") as HTMLElement | null;
        const blockRect = block.getBoundingClientRect();
        const contentRight = infoEl
            ? infoEl.getBoundingClientRect().right - blockRect.left
            : blockRect.width - resolveCalloutLayoutLength(styles, "--callout-shell-padding-right");

        const foldIconRightEdge = contentRight - foldIconRight;
        const foldIconLeftEdge = foldIconRightEdge - foldIconSize;
        const foldCenterX = (foldIconLeftEdge + foldIconRightEdge) / 2;
        foldButtonLeft = Math.max(0, foldCenterX - foldHitWidth / 2);
        foldButtonRight = foldCenterX + foldHitWidth / 2;
    }

    return {
        typeMenuLeft,
        typeMenuRight,
        headerHeight,
        foldButtonLeft,
        foldButtonRight,
    };
}

export function isFoldButtonHit(hit: CalloutHeaderHitAreas, clickX: number, clickY: number): boolean {
    return hit.foldButtonRight > hit.foldButtonLeft
        && clickX >= hit.foldButtonLeft
        && clickX <= hit.foldButtonRight
        && clickY <= hit.headerHeight;
}
