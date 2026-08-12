import { clearSessionCookie, isSameOrigin } from "../../../lib/session.ts";

export function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return new Response(JSON.stringify({ code: "forbidden_origin", error: "Origen no permitido." }), {
      status: 403,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  return new Response(JSON.stringify({ authenticated: false }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": clearSessionCookie(),
    },
  });
}
