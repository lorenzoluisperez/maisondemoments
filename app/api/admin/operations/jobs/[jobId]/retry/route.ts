import { NextResponse } from "next/server";
import { AccountSetupRequiredError, AuthenticationRequiredError, requireCurrentActor } from "@/lib/auth/current-actor";
import { isTrustedMutationRequest } from "@/lib/http/request-security";
import { OperationsAuthorizationError, OperationsConflictError, retryFailedJob } from "@/lib/operations/service";

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "Invalid request origin or content type" }, { status: 403 });
  try { const { jobId } = await params; return NextResponse.json({ job: await retryFailedJob(await requireCurrentActor(), jobId) }); }
  catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof AccountSetupRequiredError || error instanceof OperationsAuthorizationError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof OperationsConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: "Invalid task" }, { status: 400 });
  }
}
