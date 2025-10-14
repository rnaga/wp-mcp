type FetchArgs = Parameters<typeof globalThis.fetch>;
type FetchReturn = ReturnType<typeof globalThis.fetch>;

type FetchFn = (input: FetchArgs[0], init?: FetchArgs[1]) => FetchReturn;

let resolvedFetch: FetchFn | undefined =
  typeof globalThis.fetch === "function"
    ? globalThis.fetch.bind(globalThis)
    : undefined;

export const fetch: FetchFn = (input, init) => {
  if (resolvedFetch) {
    return resolvedFetch(input, init);
  }

  return import("node-fetch").then(({ default: nodeFetch }) => {
    resolvedFetch = nodeFetch as unknown as FetchFn;
    return resolvedFetch(input, init);
  });
};

export type Response = Awaited<FetchReturn>;
export type RequestInit = FetchArgs[1];
export type RequestInfo = FetchArgs[0];

export default fetch;
