import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/page-header";
import { getSessionContext } from "@/lib/queries/context";
import { createBrand } from "../actions";

export default async function NewBrandPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { workspace } = await getSessionContext();
  if (!workspace) return null;

  const { error } = await searchParams;

  return (
    <>
      <PageHeader
        title="Nova marca"
        description="Comece pelo básico — você completa o resto depois."
      />
      <div className="flex-1 p-6">
        <Card className="max-w-lg">
          <CardContent className="pt-5">
            <form action={createBrand} className="space-y-4">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <div className="space-y-2">
                <Label htmlFor="name">Nome da marca</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Ex: Davi Moxotó"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">O que essa marca faz?</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Ex: Consultoria de IA aplicada a negócios para pequenas e médias empresas."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  A IA usa essa descrição como contexto em toda geração.
                </p>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit">Criar marca</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
