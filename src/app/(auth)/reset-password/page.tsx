import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "../actions";

export default async function ResetPasswordPage({
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
            Se o email existir, você receberá um link de recuperação.
          </p>
          <Link
            href="/login"
            className="mt-3 inline-block text-sm text-muted-foreground hover:text-foreground"
          >
            Voltar ao login
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recuperar senha</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={resetPassword} className="space-y-4">
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
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full">
            Enviar link de recuperação
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/login" className="hover:text-foreground">
            Voltar ao login
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
