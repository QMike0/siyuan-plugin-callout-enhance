import { resolveCalloutLayoutLength } from "./callout_layout_vars";

/** Vertical slack below the title row when testing header clicks (icon / fold / title). */
const HEADER_HIT_EXTRA_BOTTOM = 8;

export type CalloutHeaderHitAreas = {
    typeMenuLeft: number;
    typeMenuRight: number;
    headerHeight: number;
    foldButtonWidth: number;
};

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
    const foldButtonWidth = foldVisible
        ? resolveCalloutLayoutLength(styles, "--callout-fold-hit-width")
        : 0;

    return {
        typeMenuLeft,
        typeMenuRight,
        headerHeight,
        foldButtonWidth,
    };
}
