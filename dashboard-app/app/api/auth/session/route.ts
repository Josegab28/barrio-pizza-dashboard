import { getDemoPassword, hasValidSession } from "../../../lib/session";

export async function GET(request: Request) {
  return new Response(
    JSON.stringify({
      authenticated: await hasValidSession(request),
      configured: Boolean(getDemoPassword()),
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}
