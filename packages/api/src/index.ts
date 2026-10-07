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
  rawRequest(path: string, options?: ApiRequestOptions): Promise<Response>;
  get<T = unknown>(path: string, options?: ApiRequestOptions): Promise<T>;
  post<T = unknown>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T>;
  put<T = unknown>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T>;
  patch<T = unknown>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T>;
  delete<T = unknown>(path: string, options?: ApiRequestOptions): Promise<T>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly response: Response;
  readonly data: unknown;

  constructor(message: string, status: number, response: Response, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.response = response;
    this.data = data;
  }
}

export function createApiClient(options: CreateApiClientOptions): ApiClient {
  const fetcher = options.fetcher ?? globalThis.fetch?.bind(globalThis);

  if (!fetcher) {
    throw new Error("createApiClient requires a fetch implementation.");
  }

  async function rawRequest(path: string, requestOptions: ApiRequestOptions = {}): Promise<Response> {
    const { query, body, headers, ...init } = requestOptions;
    const requestHeaders = new Headers(options.defaultHeaders);

    if (headers) {
      new Headers(headers).forEach((value, key) => requestHeaders.set(key, value));
    }

    const accessToken = await options.getAccessToken?.();

    if (accessToken && !requestHeaders.has("Authorization")) {
      requestHeaders.set("Authorization", "Bearer " + accessToken);
    }

    const requestInit: RequestInit = {
      ...init,
      headers: requestHeaders
    };

    if (body !== undefined) {
      requestInit.body = prepareBody(body, requestHeaders);
    }

    const response = await fetcher(resolveUrl(options.baseUrl, path, query), requestInit);

    if (response.status === 401) {
      await options.onUnauthorized?.(response);
    }

    if (!response.ok) {
      const data = await parseResponse(response);
      throw new ApiError("API request failed with status " + response.status, response.status, response, data);
    }

    return response;
  }

  async function request<T = unknown>(path: string, requestOptions: ApiRequestOptions = {}): Promise<T> {
    const response = await rawRequest(path, requestOptions);
    return (await parseResponse(response)) as T;
  }

  return {
    request,
    rawRequest,
    get: (path, requestOptions) => request(path, { ...requestOptions, method: "GET" }),
    post: (path, body, requestOptions) => request(path, { ...requestOptions, method: "POST", body }),
    put: (path, body, requestOptions) => request(path, { ...requestOptions, method: "PUT", body }),
    patch: (path, body, requestOptions) => request(path, { ...requestOptions, method: "PATCH", body }),
    delete: (path, requestOptions) => request(path, { ...requestOptions, method: "DELETE" })
  };
}

function resolveUrl(baseUrl: string, path: string, query?: ApiRequestOptions["query"]) {
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

function stripTrailingSlashes(value: string) {
  let normalized = value;

  while (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  return normalized || "/";
}

function prepareBody(body: unknown, headers: Headers): BodyInit {
  if (isBodyInit(body)) {
    return body;
  }

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return JSON.stringify(body);
}

async function parseResponse(response: Response) {
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

function isBodyInit(value: unknown): value is BodyInit {
  return (
    typeof value === "string" ||
    value instanceof ArrayBuffer ||
    (typeof Blob !== "undefined" && value instanceof Blob) ||
    (typeof FormData !== "undefined" && value instanceof FormData) ||
    (typeof URLSearchParams !== "undefined" && value instanceof URLSearchParams) ||
    (typeof ReadableStream !== "undefined" && value instanceof ReadableStream)
  );
}
