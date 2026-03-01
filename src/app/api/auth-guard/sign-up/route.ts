import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { handleGuardedAuthRequest, validateSignUpPayload } from "@/lib/auth/guard";
import {
  createPendingRegistration,
  RegistrationApprovalError,
} from "@/lib/auth/registration-approval";

export async function POST(request: NextRequest) {
  return handleGuardedAuthRequest(request, {
    action: "sign-up",
    validate: validateSignUpPayload,
    customHandler: async (incomingRequest, payload) => {
      try {
        const result = await createPendingRegistration({
          name: payload.name,
          email: payload.email,
          password: payload.password,
          callbackURL: payload.callbackURL,
          request: incomingRequest,
        });

        if (result.status === "already_pending") {
          return NextResponse.json(
            {
              status: "pending_approval",
              message:
                "Заявка на регистрацию уже отправлена администратору. Дождитесь решения в Telegram.",
            },
            { status: 202 }
          );
        }

        return NextResponse.json(
          {
            status: "pending_approval",
            message:
              "Заявка на регистрацию отправлена администратору в Telegram. После одобрения вы сможете войти.",
          },
          { status: 202 }
        );
      } catch (error) {
        if (error instanceof RegistrationApprovalError) {
          return NextResponse.json({ message: error.message }, { status: error.status });
        }

        console.error("[auth-guard:sign-up:error]", error);
        return NextResponse.json(
          { message: "Серверная ошибка при регистрации. Проверьте логи сервера." },
          { status: 500 }
        );
      }
    },
  });
}

