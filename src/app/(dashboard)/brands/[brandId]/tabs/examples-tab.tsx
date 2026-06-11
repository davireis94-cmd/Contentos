import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addExample, deleteExample } from "../../actions";

interface ExamplesTabProps {
  brandId: string;
  examples: { id: string; content: string; created_at: string }[];
}

export function ExamplesTab({ brandId, examples }: ExamplesTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-5">
          <form action={addExample} className="space-y-3">
            <input type="hidden" name="brandId" value={brandId} />
            <div className="space-y-2">
              <Label htmlFor="content">Adicionar post anterior</Label>
              <Textarea
                id="content"
                name="content"
                rows={5}
                required
                placeholder="Cole aqui a legenda ou o texto completo de um post que performou bem. A IA aprende seu estilo com esses exemplos."
              />
            </div>
            <Button type="submit" size="sm">
              Adicionar exemplo
            </Button>
          </form>
        </CardContent>
      </Card>

      {examples.map((example) => (
        <Card key={example.id}>
          <CardContent className="flex items-start gap-3 pt-5">
            <p className="flex-1 whitespace-pre-wrap text-sm text-muted-foreground">
              {example.content.length > 400
                ? example.content.slice(0, 400) + "…"
                : example.content}
            </p>
            <form action={deleteExample}>
              <input type="hidden" name="brandId" value={brandId} />
              <input type="hidden" name="exampleId" value={example.id} />
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
