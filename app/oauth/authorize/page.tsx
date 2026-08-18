import { redirect } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import AuthCard from "@/components/auth/AuthCard";
import { getCurrentSession } from "@/lib/auth-session";
import { findOAuthClient, isRedirectUriRegistered } from "@/lib/mcp/oauth-clients";

type SearchParams = Record<string, string | string[] | undefined>;

const getParam = (searchParams: SearchParams, key: string) => {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
};

const buildQueryString = (searchParams: SearchParams) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    const resolved = Array.isArray(value) ? value[0] : value;
    if (resolved !== undefined) {
      params.set(key, resolved);
    }
  }
  return params.toString();
};

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const responseType = getParam(searchParams, "response_type");
  const clientId = getParam(searchParams, "client_id");
  const redirectUri = getParam(searchParams, "redirect_uri");
  const codeChallenge = getParam(searchParams, "code_challenge");
  const codeChallengeMethod = getParam(searchParams, "code_challenge_method");
  const state = getParam(searchParams, "state") || "";
  const scope = getParam(searchParams, "scope") || "mcp";

  if (!clientId || !redirectUri) {
    return (
      <AuthShell>
        <AuthCard
          title="Authorization request invalid"
          description="This link is missing client_id or redirect_uri and cannot continue."
        >
          <p className="text-sm text-slate-600">
            Ask the connecting application to restart the connection.
          </p>
        </AuthCard>
      </AuthShell>
    );
  }

  const client = await findOAuthClient(clientId);
  if (!client || !isRedirectUriRegistered(client, redirectUri)) {
    return (
      <AuthShell>
        <AuthCard
          title="Authorization request invalid"
          description="This application is not recognized, or its redirect address does not match what was registered."
        >
          <p className="text-sm text-slate-600">
            For your safety we will not redirect to an unregistered address.
          </p>
        </AuthCard>
      </AuthShell>
    );
  }

  const redirectWithError = (error: string, description: string) => {
    const url = new URL(redirectUri);
    url.searchParams.set("error", error);
    url.searchParams.set("error_description", description);
    if (state) {
      url.searchParams.set("state", state);
    }
    redirect(url.toString());
  };

  if (responseType !== "code") {
    redirectWithError(
      "unsupported_response_type",
      "Only response_type=code is supported.",
    );
  }

  if (!codeChallenge || codeChallengeMethod !== "S256") {
    redirectWithError(
      "invalid_request",
      "A PKCE code_challenge using the S256 method is required.",
    );
  }

  const session = await getCurrentSession();
  if (!session?.user?.email) {
    const selfUrl = `/oauth/authorize?${buildQueryString(searchParams)}`;
    redirect(`/login?callbackUrl=${encodeURIComponent(selfUrl)}`);
  }

  if (!session.user?.emailVerified) {
    return (
      <AuthShell>
        <AuthCard
          title="Verify your email first"
          description={`Sign in to AI Article Publisher and verify your email before connecting "${client.clientName}".`}
        >
          <p className="text-sm text-slate-600">
            Once your email is verified, restart the connection from ChatGPT.
          </p>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthCard
        title="Connect to your workspace"
        description={`"${client.clientName}" wants to access your AI Article Publisher account.`}
      >
        <div className="panel-muted space-y-3 px-4 py-4 text-sm text-slate-700">
          <p>
            Signed in as <span className="font-semibold">{session.user.email}</span>
          </p>
          <p className="text-xs text-slate-500">
            This will allow {client.clientName} to, on your behalf:
          </p>
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
            <li>Read your connected WordPress sites, categories, and tags</li>
            <li>Search news and generate article drafts (spends your tokens)</li>
            <li>Create, update, and publish WordPress posts on sites you own</li>
          </ul>
        </div>
        <form method="POST" action="/api/oauth/authorize" className="mt-5 flex gap-3">
          <input type="hidden" name="response_type" value="code" />
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="redirect_uri" value={redirectUri} />
          <input type="hidden" name="code_challenge" value={codeChallenge} />
          <input type="hidden" name="code_challenge_method" value={codeChallengeMethod} />
          <input type="hidden" name="state" value={state} />
          <input type="hidden" name="scope" value={scope} />
          <button type="submit" name="decision" value="deny" className="button-secondary flex-1">
            Deny
          </button>
          <button type="submit" name="decision" value="approve" className="button-primary flex-1">
            Approve
          </button>
        </form>
      </AuthCard>
    </AuthShell>
  );
}
