import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { RedirectSignal } from "../support/next-navigation-stub.mjs";

const { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser, requireChatGPTUser } = await import(
  "../../app/chatgpt-auth.ts"
);

function withHeaders(headers) {
  globalThis.__testRequestHeaders = headers;
}

afterEach(() => {
  delete globalThis.__testRequestHeaders;
});

test("keeps the relative return path when signing in and out", () => {
  assert.equal(chatGPTSignInPath("/pedido?vista=datos#alertas"), "/signin-with-chatgpt?return_to=%2Fpedido%3Fvista%3Ddatos%23alertas");
  assert.equal(chatGPTSignOutPath("/pedido"), "/signout-with-chatgpt?return_to=%2Fpedido");
  assert.equal(chatGPTSignOutPath(), "/signout-with-chatgpt?return_to=%2F");
});

test("falls back to the root for return paths that could leave the app", () => {
  for (const unsafe of ["//evil.example", "https://evil.example/pedido", "pedido", "", "\\evil"]) {
    assert.equal(chatGPTSignInPath(unsafe), "/signin-with-chatgpt?return_to=%2F");
  }
});

test("refuses to bounce back into the authentication endpoints", () => {
  for (const reserved of ["/signin-with-chatgpt", "/signout-with-chatgpt", "/callback"]) {
    assert.equal(chatGPTSignInPath(reserved), "/signin-with-chatgpt?return_to=%2F");
  }
  assert.equal(
    chatGPTSignInPath("/callback?code=1"),
    "/signin-with-chatgpt?return_to=%2F",
  );
});

test("reads the authenticated user from the platform headers", async () => {
  withHeaders({
    "oai-authenticated-user-id": "user-1",
    "oai-authenticated-user-email": "compras@barriopizza.com",
    "oai-authenticated-user-full-name": "Jos%C3%A9%20Rodr%C3%ADguez",
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
  });

  assert.deepEqual(await getChatGPTUser(), {
    userId: "user-1",
    email: "compras@barriopizza.com",
    fullName: "José Rodríguez",
    displayName: "José Rodríguez",
  });
});

test("uses the email as display name when the full name is missing or badly encoded", async () => {
  withHeaders({
    "oai-authenticated-user-id": "user-1",
    "oai-authenticated-user-email": "compras@barriopizza.com",
  });
  assert.deepEqual(await getChatGPTUser(), {
    userId: "user-1",
    email: "compras@barriopizza.com",
    fullName: null,
    displayName: "compras@barriopizza.com",
  });

  withHeaders({
    "oai-authenticated-user-id": "user-1",
    "oai-authenticated-user-email": "compras@barriopizza.com",
    "oai-authenticated-user-full-name": "Jos%C3",
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
  });
  assert.equal((await getChatGPTUser()).displayName, "compras@barriopizza.com");

  withHeaders({
    "oai-authenticated-user-id": "user-1",
    "oai-authenticated-user-email": "compras@barriopizza.com",
    "oai-authenticated-user-full-name": "Jos%C3%A9",
  });
  assert.equal((await getChatGPTUser()).fullName, null);
});

test("treats a partially identified request as anonymous", async () => {
  withHeaders({ "oai-authenticated-user-id": "user-1" });
  assert.equal(await getChatGPTUser(), null);

  withHeaders({ "oai-authenticated-user-email": "compras@barriopizza.com" });
  assert.equal(await getChatGPTUser(), null);

  withHeaders({});
  assert.equal(await getChatGPTUser(), null);
});

test("returns the user or redirects to sign in when access is required", async () => {
  withHeaders({
    "oai-authenticated-user-id": "user-1",
    "oai-authenticated-user-email": "compras@barriopizza.com",
  });
  assert.equal((await requireChatGPTUser("/pedido")).userId, "user-1");

  withHeaders({});
  await assert.rejects(
    () => requireChatGPTUser("/pedido"),
    (error) => {
      assert.ok(error instanceof RedirectSignal);
      assert.equal(error.location, "/signin-with-chatgpt?return_to=%2Fpedido");
      return true;
    },
  );
});
