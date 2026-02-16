import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, email, first_name, last_name, forwarding_address } = body;

    if (!id || !email || !first_name || !last_name || !forwarding_address) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Verify the user ID corresponds to a real auth user before inserting
    const { data: authUser, error: authLookupError } = await supabase.auth.admin.getUserById(id);
    if (authLookupError || !authUser?.user) {
      return NextResponse.json({ error: "Invalid user" }, { status: 403 });
    }

    // Ensure the email matches what Supabase auth has for this user
    if (authUser.user.email?.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: "Invalid user" }, { status: 403 });
    }

    const { error } = await supabase.from("profiles").insert({
      id,
      email,
      first_name,
      last_name,
      forwarding_address,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
