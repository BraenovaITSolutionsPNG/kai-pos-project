import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const message = Array.isArray(params.message)
    ? params.message[0]
    : params.message;

  return <LoginForm message={message} />;
}