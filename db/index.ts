import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

type CloudflareRuntimeEnv = {
  DB?: Parameters<typeof drizzle>[0];
};

async function getCloudflareEnv() {
  const importer = new Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<{ env: CloudflareRuntimeEnv }>;
  return (await importer("cloudflare:workers")).env;
}

export async function getDb() {
  const env = await getCloudflareEnv();
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}
