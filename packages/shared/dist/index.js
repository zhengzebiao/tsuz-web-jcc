export const MFE_APP_ROUTE = "/apps/mfe-app";
export const MFE_APP_BASENAME = MFE_APP_ROUTE;
export const DEFAULT_API_BASE_URL = "/api";
export const DEFAULT_MFE_APP_ENTRY = "//localhost:7202";
export const mfeAppMeta = {
    name: "mfe-app",
    title: "Business App",
    activeRule: MFE_APP_ROUTE,
    basename: MFE_APP_BASENAME,
    port: 7202
};
export const microAppMetas = [mfeAppMeta];
export function classNames(...values) {
    const classes = [];
    for (const value of values) {
        if (!value) {
            continue;
        }
        if (typeof value === "string" || typeof value === "number") {
            classes.push(String(value));
            continue;
        }
        for (const [className, enabled] of Object.entries(value)) {
            if (enabled) {
                classes.push(className);
            }
        }
    }
    return classes.join(" ");
}
export const cx = classNames;
export function matchesActiveRoute(activeRule, pathname) {
    const normalizedRule = stripTrailingSlashes(activeRule || "/");
    const normalizedPath = stripTrailingSlashes(pathname || "/");
    if (normalizedRule === "/") {
        return normalizedPath === "/";
    }
    return normalizedPath === normalizedRule || normalizedPath.startsWith(normalizedRule + "/");
}
function stripTrailingSlashes(value) {
    let normalized = value;
    while (normalized.length > 1 && normalized.endsWith("/")) {
        normalized = normalized.slice(0, -1);
    }
    return normalized || "/";
}
