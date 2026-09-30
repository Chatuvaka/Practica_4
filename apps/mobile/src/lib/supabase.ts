import { createSupabaseClient } from "@checador/supabase";

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL;

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_URL no está configurada en Mobile"
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_ANON_KEY no está configurada en Mobile"
  );
}

export const supabase = createSupabaseClient(
  supabaseUrl,
  supabaseAnonKey
);