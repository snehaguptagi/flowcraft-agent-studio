import { createEmailDraft, jsonError } from "../../../../lib/connection-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    return Response.json({ output: await createEmailDraft(request, await request.json()) });
  } catch (error) {
    return jsonError(error, 400);
  }
}
