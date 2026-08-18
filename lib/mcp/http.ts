export const readFormOrJson = async (request: Request): Promise<Map<string, string>> => {
  const contentType = request.headers.get("content-type") || "";
  const values = new Map<string, string>();
  if (contentType.includes("application/json")) {
    const json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    for (const [key, value] of Object.entries(json)) {
      if (typeof value === "string") {
        values.set(key, value);
      }
    }
    return values;
  }
  const form = await request.formData();
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") {
      values.set(key, value);
    }
  }
  return values;
};
