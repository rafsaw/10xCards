import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";

const PROTECTED_ROUTES = ["/dashboard", "/generate", "/review", "/library", "/settings"];

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;
  } else {
    context.locals.user = null;
  }

  // Retention state: presence of an account_deletion_requests row means the
  // account is pending deletion and read-only (the invariant — row exists =
  // pending & cancellable, even past retention_until). PK lookup on user_id.
  if (context.locals.user && supabase) {
    const { data: row, error } = await supabase
      .from("account_deletion_requests")
      .select("retention_until")
      .eq("user_id", context.locals.user.id)
      .maybeSingle<{ retention_until: string }>();

    if (error) {
      // Fail closed: a transient DB error must not hand a pending user a write
      // window. Brief read-only during an outage is the accepted cost.
      context.locals.isReadOnly = true;
      context.locals.retentionUntil = null;
    } else {
      context.locals.isReadOnly = !!row;
      context.locals.retentionUntil = row?.retention_until ?? null;
    }
  } else {
    context.locals.isReadOnly = false;
    context.locals.retentionUntil = null;
  }

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }
  }

  return next();
});
