import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://piqypzkwxkgwjvpbftyd.supabase.co";
const supabaseKey = "sb_publishable_4j3n2y9x8eHd6b9A9UjbwA_MeI6opJC";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);