import { finishOAuth, jsonError } from "../../../../lib/connection-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return Response.redirect(await finishOAuth(request), 303);
  } catch (error) {
    const url = new URL("/", request.url);
    url.searchParams.set("connection", "error");
    url.searchParams.set("reason", error instanceof Error ? error.message : "OAuth callback failed.");
    try {
      return Response.redirect(url.toString(), 303);
    } catch {
      return jsonError(error, 400);
    }
  }
}
