export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function isMySqlMode(): boolean {
  return process.env.NEXT_PUBLIC_DB_MODE === "mysql";
}

export function isDemoMode(): boolean {
  return !isMySqlMode() && process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}