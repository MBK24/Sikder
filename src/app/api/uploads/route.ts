import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getForumViewer } from "@/server/forum";
import { rateLimit } from "@/server/ratelimit";
import { FORUM_LIMITS } from "@/config/reputation";

/**
 * Issues short-lived, scoped client-upload tokens for forum images (Vercel Blob).
 * The browser uploads straight to storage; this route only signs the request after checking
 * the user may post, the path is inside their own folder, and the file is a small image.
 */
export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Image uploads aren't configured." }, { status: 503 });
  }
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const v = await getForumViewer();
        if (!v?.canPost) throw new Error("Not allowed to upload");
        if (!pathname.startsWith(`forum/${v.id}/`)) throw new Error("Invalid path");
        const l = FORUM_LIMITS.upload;
        if (!(await rateLimit(`forum:upload:${v.id}`, l.max, l.windowSec))) throw new Error("Too many uploads");
        return {
          allowedContentTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
          maximumSizeInBytes: 5 * 1024 * 1024,
          addRandomSuffix: true,
          validUntil: Date.now() + 10 * 60_000,
        };
      },
    });
    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
