// app/api/admin/leads/[id]/route.ts
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json(); // 예: { status: "DONE" }

    // TODO: DB 업데이트 로직 (prisma/sql/whatever)
    // await db.lead.update({ where: { id }, data: { status: body.status } });

    return NextResponse.json({ ok: true, id, updated: body }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "UPDATE_FAILED" }, { status: 500 });
  }
}