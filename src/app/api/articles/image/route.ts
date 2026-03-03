import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { getUserArticleWriteAccess } from "@/lib/auth/article-permissions";

export const runtime = "nodejs";

const allowedMimeTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

const maxFileSize = 5 * 1024 * 1024;

function badRequest(message: string, status = 400) {
  return NextResponse.json({ message }, { status });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return badRequest("Нужна авторизация.", 401);
  }

  const canManageArticles = await getUserArticleWriteAccess(
    session.user.id,
    (session.user as { role?: unknown }).role
  );

  if (!canManageArticles) {
    return badRequest("Недостаточно прав для загрузки изображений в статьи.", 403);
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return badRequest("Выберите файл с изображением.");
  }

  if (!allowedMimeTypes.has(file.type)) {
    return badRequest("Поддерживаются только JPG, PNG, WEBP и GIF.");
  }

  if (file.size === 0) {
    return badRequest("Файл пустой.");
  }

  if (file.size > maxFileSize) {
    return badRequest("Изображение слишком большое. Ограничение 5 МБ.");
  }

  const extension = allowedMimeTypes.get(file.type);
  const fileName = `${session.user.id}-${Date.now()}-${randomUUID()}.${extension}`;
  const uploadDirectory = path.join(process.cwd(), "public", "uploads", "articles");
  const fullPath = path.join(uploadDirectory, fileName);
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  await mkdir(uploadDirectory, { recursive: true });
  await writeFile(fullPath, fileBuffer);

  return NextResponse.json({
    imageUrl: `/api/articles/image/${fileName}`,
  });
}
