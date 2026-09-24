import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "../../../../src/features/admin/service";
import { getCurrentSessionUser } from "../../../../src/features/auth/http-session";
import {
  createNotice,
  listNoticesForAdmin,
} from "../../../../src/features/notices/service";
import { DomainError } from "../../../../src/lib/http";

const NoticeInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1),
  status: z.enum(["draft", "published"]),
});

function errorResponse(error: unknown) {
  if (error instanceof DomainError) {
    return NextResponse.json({ code: error.code }, { status: error.status });
  }
  throw error;
}

export async function GET() {
  try {
    requireAdmin(await getCurrentSessionUser());
    return NextResponse.json({
      notices: await listNoticesForAdmin(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    requireAdmin(user);
    const parsed = NoticeInputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
    }
    const result = await createNotice(user.id, parsed.data);
    return NextResponse.json(
      {
        status: "ok",
        notice: result.notice,
        didPublish: result.didPublish,
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
