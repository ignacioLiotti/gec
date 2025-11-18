import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("OAuth callback error:", error);
      return NextResponse.redirect(`${origin}/?error=auth_failed`);
    }

    // Give session time to fully persist to cookies
    await new Promise(resolve => setTimeout(resolve, 200));

    // Check if user has completed onboarding (has tenant membership)
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: memberships } = await supabase
        .from("memberships")
        .select("tenant_id")
        .eq("user_id", user.id)
        .limit(1);

      // If no memberships, redirect to onboarding
      if (!memberships || memberships.length === 0) {
        return NextResponse.redirect(`${origin}/onboarding`);
      }
    }
  }

  // Redirect to home page after successful authentication
  return NextResponse.redirect(origin);
}
