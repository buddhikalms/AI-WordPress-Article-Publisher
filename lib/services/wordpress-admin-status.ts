import { decryptSecret } from "@/lib/crypto";
import { getErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  getSiteHealthTest,
  listPlugins,
  listThemes,
  type WpConfig,
  type WpPluginStatus,
  type WpSiteHealthTest,
} from "@/lib/wp";

type EndpointResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const readEndpoint = async <T>(fn: () => Promise<T>): Promise<EndpointResult<T>> => {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
};

const hasUpdateMarker = (item: { update?: unknown }) =>
  Boolean(
    item.update &&
      (typeof item.update !== "object" ||
        Object.keys(item.update as Record<string, unknown>).length > 0),
  );

const countActivePlugins = (plugins: WpPluginStatus[]) =>
  plugins.filter((plugin) => plugin.status === "active").length;

export const getAdminWordPressStatus = async () => {
  const sites = await prisma.wordPressCredential.findMany({
    select: {
      id: true,
      name: true,
      baseUrl: true,
      username: true,
      updatedAt: true,
      user: {
        select: {
          email: true,
          name: true,
        },
      },
      appPasswordEncrypted: true,
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  return Promise.all(
    sites.map(async (site) => {
      const config: WpConfig = {
        baseUrl: site.baseUrl,
        username: site.username,
        appPassword: decryptSecret(site.appPasswordEncrypted),
      };

      const [plugins, themes, coreUpdate, pluginUpdate, themeUpdate, backgroundUpdate] =
        await Promise.all([
          readEndpoint(() => listPlugins(config)),
          readEndpoint(() => listThemes(config)),
          readEndpoint(() => getSiteHealthTest("wordpress-version", config)),
          readEndpoint(() => getSiteHealthTest("plugin-versions", config)),
          readEndpoint(() => getSiteHealthTest("theme-versions", config)),
          readEndpoint(() => getSiteHealthTest("background-updates", config)),
        ]);

      const pluginData = plugins.ok ? plugins.data : [];
      const themeData = themes.ok ? themes.data : [];
      const healthTests = [coreUpdate, pluginUpdate, themeUpdate, backgroundUpdate]
        .filter((result): result is { ok: true; data: WpSiteHealthTest } => result.ok)
        .map((result) => result.data);
      const warnings = [coreUpdate, pluginUpdate, themeUpdate, backgroundUpdate]
        .filter(
          (result): result is { ok: false; error: string } => !result.ok,
        )
        .map((result) => result.error);

      return {
        site: {
          id: site.id,
          name: site.name,
          baseUrl: site.baseUrl,
          username: site.username,
          updatedAt: site.updatedAt,
          owner: site.user.email || site.user.name || "Unknown user",
        },
        plugins: plugins.ok
          ? {
              ok: true,
              total: pluginData.length,
              active: countActivePlugins(pluginData),
              updateMarkers: pluginData.filter(hasUpdateMarker).length,
              items: pluginData,
            }
          : { ok: false, error: plugins.error },
        themes: themes.ok
          ? {
              ok: true,
              total: themeData.length,
              active: themeData.filter((theme) => theme.status === "active").length,
              updateMarkers: themeData.filter(hasUpdateMarker).length,
              items: themeData,
            }
          : { ok: false, error: themes.error },
        health: {
          tests: healthTests,
          warnings,
          needsAttention: healthTests.filter((test) => test.status && test.status !== "good").length,
        },
      };
    }),
  );
};
