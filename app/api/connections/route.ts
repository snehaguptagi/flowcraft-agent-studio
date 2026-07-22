import { createConnection, jsonError, listConnections } from "../../lib/connection-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return Response.json({ connections: await listConnections(request) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const connection = await createConnection(request, await request.json());
    return Response.json({ connection }, { status: 201 });
  } catch (error) {
    return jsonError(error, 400);
  }
}
