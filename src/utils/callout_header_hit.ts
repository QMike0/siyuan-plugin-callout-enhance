import {
    CalloutLayoutVarName,
    DEFAULT_CALLOUT_LAYOUT,
    resolveCalloutLayoutLength,
} from "./callout_layout_vars";

/** Vertical slack below the first title line when testing icon / fold clicks. */
const CHROME_HIT_EXTRA_BOTTOM = 8;

export type CalloutHeaderHitAreas = {
    typeMenuLeft: number;
    typeMenuRight: number;
    /** @deprecated Use firstLineBandBottom for icon/fold; kept for callers migrating gradually. */
    headerHeight: number;
    /** Block-relative Y ceiling for type-icon and fold-button hits (first title line band). */
    firstLineBandBottom: number;
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

function resolveFirstLineHeightPx(styles: CSSStyleDeclaration): number {
    const titleFontSize = resolveLayoutLengthPx(styles, "--callout-title-font-size");
    const lineHeightRaw = styles.getPropertyValue("--callout-title-line-height").trim()
        || DEFAULT_CALLOUT_LAYOUT["--callout-title-line-height"];
    const lineHeight = parseFloat(lineHeightRaw);
    const multiplier = Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : 1.625;
    return titleFontSize * multiplier;
}

/**
 * Header click-hit geometry for a callout block (coordinates relative to the block border box).
 */
export function getCalloutHeaderHitAreas(block: HTMLElement): CalloutHeaderHitAreas {
    const styles = getComputedStyle(block);
    const iconLeft = resolveCalloutLayoutLength(styles, "--callout-icon-left");
    const headerXShift = resolveCalloutLayoutLength(styles, "--callout-header-width-offset", "--callout-header-x-shift");
    const iconSize = resolveCalloutLayoutLength(styles, "--callout-icon-size");
    const shellPaddingTop = resolveCalloutLayoutLength(styles, "--callout-shell-padding-top");
    const headerYAdjust = resolveCalloutLayoutLength(styles, "--callout-header-y-adjust");
    const firstLineHeight = resolveFirstLineHeightPx(styles);

    const iconCenterX = iconLeft + headerXShift + iconSize / 2;
    const typeMenuHalfWidth = Math.max(12, iconSize * 0.7);
    const typeMenuLeft = Math.max(0, iconCenterX - typeMenuHalfWidth);
    const typeMenuRight = iconCenterX + typeMenuHalfWidth;

    const infoEl = block.querySelector(".callout-info") as HTMLElement | null;
    const blockRect = block.getBoundingClientRect();
    const infoBottom = infoEl
        ? infoEl.getBoundingClientRect().bottom - blockRect.top
        : shellPaddingTop + resolveCalloutLayoutLength(styles, "--callout-header-height", "--callout-title-row-height");

    const firstLineBandBottom = shellPaddingTop + headerYAdjust + firstLineHeight + CHROME_HIT_EXTRA_BOTTOM;

    const foldVisible = styles.getPropertyValue("--callout-fold-after-display").trim() !== "none";
    let foldButtonLeft = 0;
    let foldButtonRight = 0;

    if (foldVisible) {
        const foldHitWidth = resolveCalloutLayoutLength(styles, "--callout-fold-hit-width");
        const foldIconRight = resolveLayoutLengthPx(styles, "--callout-fold-icon-right");
        const foldIconSize = resolveLayoutLengthPx(styles, "--callout-fold-icon-size");

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
        headerHeight: infoBottom + CHROME_HIT_EXTRA_BOTTOM,
        firstLineBandBottom,
        foldButtonLeft,
        foldButtonRight,
    };
}

export function isFoldButtonHit(hit: CalloutHeaderHitAreas, clickX: number, clickY: number): boolean {
    return hit.foldButtonRight > hit.foldButtonLeft
        && clickX >= hit.foldButtonLeft
        && clickX <= hit.foldButtonRight
        && clickY <= hit.firstLineBandBottom;
}
