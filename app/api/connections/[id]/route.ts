import { deleteConnection, jsonError } from "../../../lib/connection-server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

async function routeId(context: RouteContext) {
  const params = await context.params;
  return params.id;
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    await deleteConnection(request, await routeId(context));
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
