import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

const { POST: login } = await import("../../app/api/auth/login/route.ts");
const { POST: logout } = await import("../../app/api/auth/logout/route.ts");
const { GET: session } = await import("../../app/api/auth/session/route.ts");

const PASSWORD = "clave-de-prueba";

function request(path, { body, headers } = {}) {
  return new Request(`http://localhost${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

function cookieValue(response) {
  return (response.headers.get("set-cookie") ?? "").split(";")[0];
}

beforeEach(() => {
  process.env.DEMO_ACCESS_PASSWORD = PASSWORD;
  process.env.DEMO_SESSION_SECRET = "secreto-de-prueba";
});

afterEach(() => {
  delete process.env.DEMO_ACCESS_PASSWORD;
  delete process.env.DEMO_SESSION_SECRET;
});

test("reports that the demo access is not configured when the password is missing", async () => {
  delete process.env.DEMO_ACCESS_PASSWORD;

  const response = await login(request("/api/auth/login", { body: { password: PASSWORD } }));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "not_configured");

  const state = await session(request("/api/auth/session"));
  assert.deepEqual(await state.json(), { authenticated: false, configured: false });
});

test("rejects a wrong, empty or oversized password without setting a cookie", async () => {
  for (const password of ["", "otra", "x".repeat(201), 42]) {
    const response = await login(request("/api/auth/login", { body: { password } }));
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, "invalid_credentials");
    assert.equal(response.headers.get("set-cookie"), null);
  }
});

test("rejects a login body that is not valid JSON", async () => {
  const response = await login(request("/api/auth/login", { body: "{" }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "invalid_json");
});

test("rejects login and logout requests coming from another origin", async () => {
  const headers = { origin: "https://attacker.example" };

  const attemptedLogin = await login(request("/api/auth/login", { body: { password: PASSWORD }, headers }));
  assert.equal(attemptedLogin.status, 403);
  assert.equal(attemptedLogin.headers.get("set-cookie"), null);

  const attemptedLogout = await logout(request("/api/auth/logout", { body: {}, headers }));
  assert.equal(attemptedLogout.status, 403);
});

test("issues a hardened session cookie that the session endpoint accepts", async () => {
  const response = await login(request("/api/auth/login", { body: { password: PASSWORD } }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { authenticated: true });

  const setCookie = response.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /^barrio_session=demo\.\d+\.[\w-]+;/);
  for (const attribute of ["Path=/", "HttpOnly", "Secure", "SameSite=Strict", "Max-Age=28800"]) {
    assert.ok(setCookie.includes(attribute), `falta ${attribute} en ${setCookie}`);
  }

  const state = await session(request("/api/auth/session", { headers: { cookie: cookieValue(response) } }));
  assert.deepEqual(await state.json(), { authenticated: true, configured: true });
  assert.equal(state.headers.get("cache-control"), "no-store");
});

test("does not accept a tampered, foreign or expired session cookie", async () => {
  const issued = cookieValue(await login(request("/api/auth/login", { body: { password: PASSWORD } })));
  const [, payload, signature] = issued.replace("barrio_session=", "").split(".");

  const tampered = [
    "barrio_session=demo.9999999999.firma-invalida",
    `barrio_session=admin.${payload}.${signature}`,
    `barrio_session=demo.${Math.floor(Date.now() / 1000) - 10}.${signature}`,
    "barrio_session=demo.no-es-un-numero",
  ];

  for (const cookie of tampered) {
    const state = await session(request("/api/auth/session", { headers: { cookie } }));
    assert.deepEqual(await state.json(), { authenticated: false, configured: true }, cookie);
  }

  process.env.DEMO_SESSION_SECRET = "otro-secreto";
  const withRotatedSecret = await session(request("/api/auth/session", { headers: { cookie: issued } }));
  assert.equal((await withRotatedSecret.json()).authenticated, false);
});

test("clears the session cookie on logout", async () => {
  const response = await logout(request("/api/auth/logout", { body: {} }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { authenticated: false });
  assert.match(response.headers.get("set-cookie") ?? "", /^barrio_session=; .*Max-Age=0/);
});
