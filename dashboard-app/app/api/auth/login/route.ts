import {
  createSessionCookie,
  getDemoPassword,
  isSameOrigin,
  verifyPassword,
} from "../../../lib/session";

const MAX_PASSWORD_LENGTH = 200;

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return json({ code: "forbidden_origin", error: "Origen no permitido." }, 403);
  }
  if (!getDemoPassword()) {
    return json(
      {
        code: "not_configured",
        error: "El acceso de demostración no está configurado en el servidor.",
      },
      503,
    );
  }

  let body: { password?: unknown };
  try {
    body = (await request.json()) as { password?: unknown };
  } catch {
    return json({ code: "invalid_json", error: "La solicitud no contiene JSON válido." }, 400);
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (!password || password.length > MAX_PASSWORD_LENGTH || !verifyPassword(password)) {
    return json({ code: "invalid_credentials", error: "Credenciales inválidas." }, 401);
  }

  const cookie = await createSessionCookie();
  if (!cookie) {
    return json(
      { code: "not_configured", error: "El acceso de demostración no está configurado en el servidor." },
      503,
    );
  }

  return json({ authenticated: true }, 200, { "set-cookie": cookie });
}
