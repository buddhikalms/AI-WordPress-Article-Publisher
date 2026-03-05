import { NextResponse } from "next/server";
import { requireVerifiedUser } from "@/lib/auth-session";
import { toErrorResponse } from "@/lib/errors";
import {
  deleteWordpressSiteSchema,
  setDefaultWordpressSiteSchema,
  wordpressSiteSchema,
} from "@/lib/account-schemas";
import {
  deleteWordPressSite,
  listWordPressCredentialSummaries,
  saveUserWordPressConfig,
  setDefaultWordPressSite,
} from "@/lib/user-wordpress";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const sites = await listWordPressCredentialSummaries(user.id);
    return NextResponse.json({
      sites,
      defaultSiteId: sites.find((site) => site.isDefault)?.id ?? null,
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to load WordPress credentials.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const body = await request.json();
    const parsed = wordpressSiteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid WordPress site payload.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const site = await saveUserWordPressConfig({
      userId: user.id,
      siteId: parsed.data.siteId,
      name: parsed.data.siteName,
      baseUrl: parsed.data.wordpressBaseUrl,
      username: parsed.data.wordpressUsername,
      appPassword: parsed.data.wordpressPassword,
      isDefault: parsed.data.isDefault,
    });

    return NextResponse.json({
      ok: true,
      site,
      message: parsed.data.siteId
        ? "WordPress site updated."
        : "WordPress site added.",
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to save WordPress credentials.");
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const body = await request.json();
    const parsed = setDefaultWordpressSiteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid default-site payload.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const site = await setDefaultWordPressSite({
      userId: user.id,
      siteId: parsed.data.siteId,
    });

    return NextResponse.json({
      ok: true,
      site,
      message: "Default WordPress site updated.",
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to update default WordPress site.");
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const body = await request.json();
    const parsed = deleteWordpressSiteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid delete-site payload.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const deleted = await deleteWordPressSite({
      userId: user.id,
      siteId: parsed.data.siteId,
    });

    return NextResponse.json({
      ok: true,
      deleted,
      message: `Removed WordPress site "${deleted.name}".`,
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to remove WordPress site.");
  }
}
