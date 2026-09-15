export class ApiError extends Error {
    status;
    response;
    data;
    constructor(message, status, response, data) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.response = response;
        this.data = data;
    }
}
export function createApiClient(options) {
    const fetcher = options.fetcher ?? globalThis.fetch?.bind(globalThis);
    if (!fetcher) {
        throw new Error("createApiClient requires a fetch implementation.");
    }
    async function request(path, requestOptions = {}) {
        const { query, body, headers, ...init } = requestOptions;
        const requestHeaders = new Headers(options.defaultHeaders);
        if (headers) {
            new Headers(headers).forEach((value, key) => requestHeaders.set(key, value));
        }
        const accessToken = await options.getAccessToken?.();
        if (accessToken && !requestHeaders.has("Authorization")) {
            requestHeaders.set("Authorization", "Bearer " + accessToken);
        }
        const requestInit = {
            ...init,
            headers: requestHeaders
        };
        if (body !== undefined) {
            requestInit.body = prepareBody(body, requestHeaders);
        }
        const response = await fetcher(resolveUrl(options.baseUrl, path, query), requestInit);
        const data = await parseResponse(response);
        if (response.status === 401) {
            await options.onUnauthorized?.(response);
        }
        if (!response.ok) {
            throw new ApiError("API request failed with status " + response.status, response.status, response, data);
        }
        return data;
    }
    return {
        request,
        get: (path, requestOptions) => request(path, { ...requestOptions, method: "GET" }),
        post: (path, body, requestOptions) => request(path, { ...requestOptions, method: "POST", body }),
        put: (path, body, requestOptions) => request(path, { ...requestOptions, method: "PUT", body }),
        patch: (path, body, requestOptions) => request(path, { ...requestOptions, method: "PATCH", body }),
        delete: (path, requestOptions) => request(path, { ...requestOptions, method: "DELETE" })
    };
}
function resolveUrl(baseUrl, path, query) {
    const normalizedBaseUrl = stripTrailingSlashes(baseUrl);
    const normalizedPath = path.startsWith("/") ? path : "/" + path;
    const url = new URL(normalizedBaseUrl + normalizedPath, "http://tsu.local");
    for (const [key, value] of Object.entries(query ?? {})) {
        if (value !== undefined && value !== null) {
            url.searchParams.set(key, String(value));
        }
    }
    if (normalizedBaseUrl.startsWith("http://") || normalizedBaseUrl.startsWith("https://")) {
        return url.toString();
    }
    return url.pathname + url.search;
}
function stripTrailingSlashes(value) {
    let normalized = value;
    while (normalized.length > 1 && normalized.endsWith("/")) {
        normalized = normalized.slice(0, -1);
    }
    return normalized || "/";
}
function prepareBody(body, headers) {
    if (isBodyInit(body)) {
        return body;
    }
    if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }
    return JSON.stringify(body);
}
async function parseResponse(response) {
    if (response.status === 204) {
        return undefined;
    }
    const contentType = response.headers.get("Content-Type") ?? "";
    if (contentType.includes("application/json")) {
        return response.json();
    }
    const text = await response.text();
    return text || undefined;
}
function isBodyInit(value) {
    return (typeof value === "string" ||
        value instanceof ArrayBuffer ||
        (typeof Blob !== "undefined" && value instanceof Blob) ||
        (typeof FormData !== "undefined" && value instanceof FormData) ||
        (typeof URLSearchParams !== "undefined" && value instanceof URLSearchParams) ||
        (typeof ReadableStream !== "undefined" && value instanceof ReadableStream));
}
