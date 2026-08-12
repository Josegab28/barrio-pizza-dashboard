// Resolve hook so unit tests can import server modules that depend on the
// framework-provided `next/*` runtime, which only exists inside the bundler.
const stubs = new Map([
  ["next/headers", new URL("./next-headers-stub.mjs", import.meta.url).href],
  ["next/navigation", new URL("./next-navigation-stub.mjs", import.meta.url).href],
]);

export function resolve(specifier, context, nextResolve) {
  const stub = stubs.get(specifier);
  if (stub) return { url: stub, shortCircuit: true };
  return nextResolve(specifier, context);
}
