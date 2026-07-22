import { jsonError, testConnection } from "../../../../lib/connection-server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

async function routeId(context: RouteContext) {
  const params = await context.params;
  return params.id;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const connection = await testConnection(request, await routeId(context));
    return Response.json({ connection });
  } catch (error) {
    return jsonError(error, 400);
  }
}
