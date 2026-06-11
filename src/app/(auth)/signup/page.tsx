import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signup } from "../actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  if (sent) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-sm">
            Enviamos um link de confirmação para o seu email.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Confirme para começar a usar a plataforma.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Criar conta</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={signup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome</Label>
            <Input
              id="fullName"
              name="fullName"
              autoComplete="name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
            <p className="text-xs text-muted-foreground">
              Pelo menos 8 caracteres.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full">
            Criar conta
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link href="/login" className="text-foreground hover:underline">
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
