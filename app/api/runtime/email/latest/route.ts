import { jsonError, readLatestEmail } from "../../../../lib/connection-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { connectionId?: string };
    if (!payload.connectionId) return Response.json({ error: "connectionId is required" }, { status: 400 });
    return Response.json({ output: await readLatestEmail(request, payload.connectionId) });
  } catch (error) {
    return jsonError(error, 400);
  }
}
