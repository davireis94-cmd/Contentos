"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function authError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    authError("/login", "Email ou senha incorretos.");
  }

  redirect("/");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const fullName = formData.get("fullName") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (password.length < 8) {
    authError("/signup", "A senha precisa ter pelo menos 8 caracteres.");
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });

  if (error) {
    authError("/signup", error.message);
  }

  redirect("/signup?sent=1");
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;

  const { error } = await supabase.auth.resetPasswordForEmail(email);

  if (error) {
    authError("/reset-password", "Não foi possível enviar o email.");
  }

  redirect("/reset-password?sent=1");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
