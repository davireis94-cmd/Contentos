import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSessionContext } from "@/lib/queries/context";
import { createWorkspace } from "./actions";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { user, workspace } = await getSessionContext();
  if (!user) redirect("/login");
  if (workspace) redirect("/");

  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-lg font-medium tracking-tight">
            content<span className="text-muted-foreground">OS</span>
          </span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Crie seu workspace</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              O workspace organiza suas marcas, conteúdos e equipe. Você pode
              usar o nome da sua empresa ou o seu próprio nome.
            </p>
            <form action={createWorkspace} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do workspace</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Ex: Agência Aurora"
                  minLength={2}
                  required
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full">
                Criar workspace
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
