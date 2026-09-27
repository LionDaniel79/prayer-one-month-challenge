import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../src/features/admin/service";
import { getCurrentSessionUser } from "../../../../../src/features/auth/http-session";
import {
  importSamLeaderCandidates,
  parseSamLeaderWorkbookBuffer,
  validateSamLeaderUploadMeta,
} from "../../../../../src/features/sams/import";
import { DomainError } from "../../../../../src/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireAdmin(await getCurrentSessionUser());
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ code: "SAM_LEADER_FILE_REQUIRED" }, { status: 400 });
    }
    validateSamLeaderUploadMeta({ name: file.name, size: file.size });
    const rows = parseSamLeaderWorkbookBuffer(Buffer.from(await file.arrayBuffer()));
    const summary = await importSamLeaderCandidates(rows);
    return NextResponse.json({ status: "ok", summary });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ code: error.code }, { status: error.status });
    }
    throw error;
  }
}
