export interface CreateApiClientOptions {
    baseUrl: string;
    getAccessToken?: () => string | undefined | Promise<string | undefined>;
    onUnauthorized?: (response: Response) => void | Promise<void>;
    fetcher?: typeof fetch;
    defaultHeaders?: HeadersInit;
}
export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
    query?: Record<string, string | number | boolean | null | undefined>;
    body?: unknown;
}
export interface ApiClient {
    request<T = unknown>(path: string, options?: ApiRequestOptions): Promise<T>;
    get<T = unknown>(path: string, options?: ApiRequestOptions): Promise<T>;
    post<T = unknown>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T>;
    put<T = unknown>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T>;
    patch<T = unknown>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T>;
    delete<T = unknown>(path: string, options?: ApiRequestOptions): Promise<T>;
}
export declare class ApiError extends Error {
    readonly status: number;
    readonly response: Response;
    readonly data: unknown;
    constructor(message: string, status: number, response: Response, data: unknown);
}
export declare function createApiClient(options: CreateApiClientOptions): ApiClient;
//# sourceMappingURL=index.d.ts.map