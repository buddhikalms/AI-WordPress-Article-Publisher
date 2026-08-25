import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth-session";
import { deleteAiCredentialSchema, saveAiCredentialSchema } from "@/lib/account-schemas";
import {
  deleteAiProviderCredential,
  listAiProviderCredentials,
  saveAiProviderCredential,
} from "@/lib/ai-credentials";
import { toErrorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const credentials = await listAiProviderCredentials({ ownerType: "platform" });
    return NextResponse.json({ credentials });
  } catch (error) {
    return toErrorResponse(error, "Failed to load platform AI credentials.");
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminUser(request);
    const json = await request.json();
    const validation = saveAiCredentialSchema.safeParse(json);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid AI credential details.", details: validation.error.flatten() },
        { status: 400 },
      );
    }

    await saveAiProviderCredential({
      ownerType: "platform",
      ...validation.data,
    });

    const credentials = await listAiProviderCredentials({ ownerType: "platform" });
    return NextResponse.json({ message: "Platform AI provider credential saved.", credentials });
  } catch (error) {
    return toErrorResponse(error, "Failed to save platform AI credential.");
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdminUser(request);
    const json = await request.json();
    const validation = deleteAiCredentialSchema.safeParse(json);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid AI credential details.", details: validation.error.flatten() },
        { status: 400 },
      );
    }

    await deleteAiProviderCredential({
      ownerType: "platform",
      provider: validation.data.provider,
    });

    const credentials = await listAiProviderCredentials({ ownerType: "platform" });
    return NextResponse.json({ message: "Platform AI provider credential removed.", credentials });
  } catch (error) {
    return toErrorResponse(error, "Failed to remove platform AI credential.");
  }
}