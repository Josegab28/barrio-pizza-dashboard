// Test double for `next/headers`. Tests set the request headers through
// `globalThis.__testRequestHeaders`.
export async function headers() {
  return new Headers(globalThis.__testRequestHeaders ?? {});
}
