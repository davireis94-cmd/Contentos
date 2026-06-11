import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PLATFORM_LABELS, type Platform } from "@/types/app";
import { PlatformsField } from "./platforms-field";
import { addReference, deleteReference } from "../../actions";

interface ReferencesTabProps {
  brandId: string;
  references: {
    id: string;
    name: string;
    handle: string | null;
    platforms: Platform[];
  }[];
}

export function ReferencesTab({ brandId, references }: ReferencesTabProps) {
  return (
    <div className="space-y-4">
      <p className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        O Brand Brain usa essas referências como inspiração de estilo. A análise
        automática de padrões chega na V2.
      </p>

      <Card>
        <CardContent className="pt-5">
          <form action={addReference} className="space-y-4">
            <input type="hidden" name="brandId" value={brandId} />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" name="name" placeholder="Ex: Alex Hormozi" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="handle">@ handle</Label>
                <Input id="handle" name="handle" placeholder="Ex: @alexhormozi" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Plataformas</Label>
              <PlatformsField name="platforms" />
            </div>
            <Button type="submit" size="sm">
              Adicionar referência
            </Button>
          </form>
        </CardContent>
      </Card>

      {references.map((ref) => (
        <Card key={ref.id}>
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium">
              {ref.name
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{ref.name}</p>
              {ref.handle && (
                <p className="truncate text-xs text-muted-foreground">
                  {ref.handle}
                </p>
              )}
            </div>
            <div className="flex gap-1">
              {ref.platforms.map((p) => (
                <Badge key={p} variant="secondary" className="text-[10px]">
                  {PLATFORM_LABELS[p]}
                </Badge>
              ))}
            </div>
            <form action={deleteReference}>
              <input type="hidden" name="brandId" value={brandId} />
              <input type="hidden" name="referenceId" value={ref.id} />
              <button
                type="submit"
                title="Remover"
                className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </form>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
