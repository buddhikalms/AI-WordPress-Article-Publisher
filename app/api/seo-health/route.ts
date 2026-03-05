import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import { seoProviderSchema } from "@/lib/schemas";
import { getSeoDiagnosticPosts } from "@/lib/wp";
import { requireVerifiedUser } from "@/lib/auth-session";
import { getUserWordPressConfig } from "@/lib/user-wordpress";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const url = new URL(request.url);
    const siteId = url.searchParams.get("siteId") || undefined;
    const wpConfig = await getUserWordPressConfig(user.id, siteId);
    const providerInput = url.searchParams.get("provider") ?? "None";
    const providerValidation = seoProviderSchema.safeParse(providerInput);

    if (!providerValidation.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid provider query value. Use AIOSEO, Yoast, or None.",
        },
        { status: 400 },
      );
    }

    const provider = providerValidation.data;

    if (provider === "AIOSEO") {
      const posts = await getSeoDiagnosticPosts(wpConfig);
      const sample = posts[0];
      if (!sample) {
        return NextResponse.json({
          ok: true,
          provider,
          details:
            "No posts found for diagnostics. Create one post first, then re-run this health check.",
        });
      }

      const hasAioseoFields =
        Object.prototype.hasOwnProperty.call(sample, "aioseo_head") ||
        Object.prototype.hasOwnProperty.call(sample, "aioseo_meta_data");

      return NextResponse.json({
        ok: hasAioseoFields,
        provider,
        samplePostId: sample.id ?? null,
        details: hasAioseoFields
          ? "AIOSEO-related fields were detected in the REST response."
          : "AIOSEO fields were not detected. You may need the AIOSEO REST API addon and proper capabilities.",
      });
    }

    if (provider === "Yoast") {
      return NextResponse.json({
        ok: true,
        provider,
        details:
          "Yoast metadata writes are best-effort. If updates fail, register Yoast keys with show_in_rest using wp-snippets/yoast-rest-meta.php.",
      });
    }

    return NextResponse.json({
      ok: true,
      provider: "None",
      details: "No SEO provider selected.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: getErrorMessage(error, "SEO health check failed."),
      },
      { status: 500 },
    );
  }
}
