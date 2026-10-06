import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

function corsHeaders(request: Request) {
  return {
    "Access-Control-Allow-Origin": request.headers.get("Origin") ?? "*",
    "Access-Control-Allow-Headers": "Authorization",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Expose-Headers": "Content-Disposition",
    Vary: "Origin",
  };
}

// GET /download?id=<submissionId> with `Authorization: Bearer <Clerk convex token>`.
// Returns the model file as an attachment named by downloadFileName.
http.route({
  path: "/download",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const headers = corsHeaders(request);
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const versionId = url.searchParams.get("version");
    if (!id && !versionId) return new Response("Missing id", { status: 400, headers });
    let info;
    try {
      info = versionId
        ? await ctx.runQuery(internal.history.versionDownloadInfo, { versionId })
        : await ctx.runQuery(internal.queue.downloadInfo, { id: id! });
    } catch {
      return new Response("Forbidden", { status: 403, headers });
    }
    if (!info) return new Response("Not found", { status: 404, headers });
    const blob = await ctx.storage.get(info.storageId);
    if (!blob) return new Response("File missing", { status: 404, headers });
    return new Response(blob, {
      headers: {
        ...headers,
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${info.fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }),
});

http.route({
  path: "/download",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => new Response(null, { headers: corsHeaders(request) })),
});

export default http;
