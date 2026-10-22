"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string } | undefined;

export async function login(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Email and password are required." };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect("/dashboard");
}

export async function signup(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const supabase = await createClient();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const businessName = String(formData.get("business_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const plan = String(formData.get("plan") ?? "starter").toLowerCase();
  const cycle = String(formData.get("cycle") ?? "monthly").toLowerCase();

  if (!email || !password || !fullName)
    return { error: "Full name, email and password are required." };
  if (password.length < 8)
    return { error: "Password must be at least 8 characters long." };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        business_name: businessName || fullName + "'s Cafe",
        plan: ["starter", "business", "professional"].includes(plan)
          ? plan
          : "starter",
        cycle: ["monthly", "annual"].includes(cycle) ? cycle : "monthly",
      },
    },
  });

  if (error) return { error: error.message };

  // New businesses start inactive: send owners straight to billing so
  // they can submit their first payment for approval.
  if (data.session) redirect("/subscription");

  // Otherwise the project has email confirmation enabled — bounce to login.
  return { message: "Check your email to confirm your account, then log in." };
}

export async function logout(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) return { error: error.message };
  redirect("/login");
}