import { NextRequest, NextResponse } from "next/server";
import { readAuthSession } from "@/lib/auth/session-store.server";
import { listDirectoryUsersForActor } from "@/lib/auth/user-directory.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const authenticated = await readAuthSession(request.headers.get("cookie"));
  const user = authenticated?.user;
  if (!user?.id) {
    return NextResponse.json(
      { error: "No autorizado." },
      { status: 401, headers: noStoreHeaders },
    );
  }

  const id = request.nextUrl.searchParams.get("id")?.trim() || undefined;
  const users = await listDirectoryUsersForActor(
    {
      id: user.id,
      role: user.role || "user",
      ownerId: user.ownerId,
      eliminate: user.eliminate,
    },
    { id },
  );

  return NextResponse.json({ users }, { headers: noStoreHeaders });
}
