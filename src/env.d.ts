declare namespace App {
  interface Locals {
    user: import("@supabase/supabase-js").User | null;
    isReadOnly: boolean;
    retentionUntil: string | null;
  }
}
