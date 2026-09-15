export type AuthStatus = "anonymous" | "authenticating" | "authenticated";
export interface CurrentUser {
    id: string;
    name: string;
    username: string;
    roles: string[];
    permissions: string[];
}
export interface LoginCredentials {
    username: string;
    password: string;
}
export interface AuthSession {
    accessToken: string;
    expiresAt: string;
    user: CurrentUser;
}
export interface AuthBridge {
    getAccessToken: () => string | undefined;
    getCurrentUser: () => CurrentUser | undefined;
    logout: () => void;
}
export interface MicroAppMeta {
    name: string;
    title: string;
    activeRule: string;
    basename: string;
    port: number;
}
export interface MicroAppProps extends AuthBridge {
    appName: string;
    basename: string;
    apiBaseUrl: string;
    container?: HTMLElement;
}
export declare const MFE_APP_ROUTE = "/apps/mfe-app";
export declare const MFE_APP_BASENAME = "/apps/mfe-app";
export declare const DEFAULT_API_BASE_URL = "/api";
export declare const DEFAULT_MFE_APP_ENTRY = "//localhost:7202";
export declare const mfeAppMeta: {
    readonly name: "mfe-app";
    readonly title: "Business App";
    readonly activeRule: "/apps/mfe-app";
    readonly basename: "/apps/mfe-app";
    readonly port: 7202;
};
export declare const microAppMetas: readonly [{
    readonly name: "mfe-app";
    readonly title: "Business App";
    readonly activeRule: "/apps/mfe-app";
    readonly basename: "/apps/mfe-app";
    readonly port: 7202;
}];
export type ClassValue = string | number | false | null | undefined | Record<string, boolean>;
export declare function classNames(...values: ClassValue[]): string;
export declare const cx: typeof classNames;
export declare function matchesActiveRoute(activeRule: string, pathname: string): boolean;
//# sourceMappingURL=index.d.ts.map