import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import {
  deleteArticle,
  isArticleTopic,
  updateArticle,
  type UpdateArticleInput,
} from "@/lib/articles/server";

function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ articleId: string }> }
) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json(
      { message: "\u041d\u0443\u0436\u043d\u0430 \u0430\u0432\u0442\u043e\u0440\u0438\u0437\u0430\u0446\u0438\u044f." },
      { status: 401 }
    );
  }

  const { articleId } = await context.params;
  const body = (await request.json()) as Partial<UpdateArticleInput>;

  if (!body.title?.trim()) {
    return badRequest("\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u0437\u0430\u0433\u043e\u043b\u043e\u0432\u043e\u043a \u0441\u0442\u0430\u0442\u044c\u0438.");
  }

  if (!body.topic || !isArticleTopic(body.topic)) {
    return badRequest(
      "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0440\u0430\u0437\u0434\u0435\u043b \u0441\u0442\u0430\u0442\u044c\u0438."
    );
  }

  if (!body.contentHtml?.trim() || !body.contentText?.trim()) {
    return badRequest("\u0421\u0442\u0430\u0442\u044c\u044f \u043d\u0435 \u043c\u043e\u0436\u0435\u0442 \u0431\u044b\u0442\u044c \u043f\u0443\u0441\u0442\u043e\u0439.");
  }

  if (!body.contentJson || typeof body.contentJson !== "object") {
    return badRequest(
      "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u0440\u043e\u0447\u0438\u0442\u0430\u0442\u044c \u0441\u043e\u0434\u0435\u0440\u0436\u0438\u043c\u043e\u0435 \u0441\u0442\u0430\u0442\u044c\u0438."
    );
  }

  const article = await updateArticle(articleId, {
    editorId: session.user.id,
    title: body.title,
    topic: body.topic,
    category: body.category,
    summary: body.summary ?? "",
    contentHtml: body.contentHtml,
    contentJson: body.contentJson as Record<string, unknown>,
    contentText: body.contentText,
  });

  if (!article) {
    return NextResponse.json(
      { message: "\u0421\u0442\u0430\u0442\u044c\u044f \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430." },
      { status: 404 }
    );
  }

  return NextResponse.json({ article });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ articleId: string }> }
) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json(
      { message: "\u041d\u0443\u0436\u043d\u0430 \u0430\u0432\u0442\u043e\u0440\u0438\u0437\u0430\u0446\u0438\u044f." },
      { status: 401 }
    );
  }

  const { articleId } = await context.params;
  const deleted = await deleteArticle(
    articleId,
    session.user.id,
    (session.user as { role?: string }).role === "admin"
  );

  if (deleted === "not_found") {
    return NextResponse.json(
      { message: "\u0421\u0442\u0430\u0442\u044c\u044f \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430." },
      { status: 404 }
    );
  }

  if (deleted === "forbidden") {
    return NextResponse.json(
      {
        message:
          "\u0423\u0434\u0430\u043b\u044f\u0442\u044c \u0441\u0442\u0430\u0442\u044c\u044e \u043c\u043e\u0436\u0435\u0442 \u0442\u043e\u043b\u044c\u043a\u043e \u0430\u0432\u0442\u043e\u0440 \u0438\u043b\u0438 \u0430\u0434\u043c\u0438\u043d.",
      },
      { status: 403 }
    );
  }

  return NextResponse.json({ success: true });
}
