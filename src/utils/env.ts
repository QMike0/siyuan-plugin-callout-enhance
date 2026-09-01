import { getFrontend } from "siyuan";

/**
 * SiYuan mobile UI (app or mobile browser).
 * Matches hierarchyNavigate's `#sidebar` check plus official `getFrontend()`.
 * Desktop windows — even when narrow — stay on the desktop settings layout.
 */
export function isMobileUi() {
    try {
        const frontend = getFrontend();
        if (frontend === "mobile" || frontend === "browser-mobile") return true;
    } catch {
        // getFrontend is unavailable in some hosts
    }
    if (document.body.classList.contains("body--mobile")) return true;
    return !!document.getElementById("sidebar");
}

export function dialogWidth(desktop: string, mobile = "92vw") {
    return isMobileUi() ? mobile : desktop;
}
