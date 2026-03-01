import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const contentTypes = new Map([
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
  ["gif", "image/gif"],
]);

type RouteContext = {
  params: Promise<{
    fileName: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { fileName } = await context.params;
  const safeFileName = path.basename(fileName);

  if (safeFileName !== fileName) {
    return new NextResponse("Invalid file name.", { status: 400 });
  }

  const fullPath = path.join(process.cwd(), "public", "uploads", "avatars", safeFileName);

  try {
    const buffer = await readFile(fullPath);
    const extension = path.extname(safeFileName).slice(1).toLowerCase();

    return new NextResponse(buffer, {
      headers: {
        "content-type": contentTypes.get(extension) ?? "application/octet-stream",
        "cache-control": "private, no-store, max-age=0",
      },
    });
  } catch {
    return new NextResponse("Avatar not found.", { status: 404 });
  }
}
