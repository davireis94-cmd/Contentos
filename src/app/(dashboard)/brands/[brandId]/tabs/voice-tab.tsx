import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TagInput } from "@/components/brand/tag-input";
import { updateVoice } from "../../actions";

interface VoiceTabProps {
  brandId: string;
  voice: {
    tone: string;
    target_audience: string | null;
    content_pillars: string[];
    characteristic_phrases: string[];
    forbidden_words: string[];
  } | null;
}

const TONES = [
  { value: "conversational", label: "Conversacional" },
  { value: "authority", label: "Autoridade" },
  { value: "formal", label: "Formal" },
  { value: "minimalist", label: "Minimalista" },
];

export function VoiceTab({ brandId, voice }: VoiceTabProps) {
  return (
    <Card>
      <CardContent className="pt-5">
        <form action={updateVoice} className="space-y-5">
          <input type="hidden" name="brandId" value={brandId} />

          <div className="space-y-2">
            <Label>Tom de voz</Label>
            <Select name="tone" defaultValue={voice?.tone ?? "conversational"}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetAudience">Público-alvo</Label>
            <Textarea
              id="targetAudience"
              name="targetAudience"
              defaultValue={voice?.target_audience ?? ""}
              rows={3}
              placeholder="Ex: Empresários de 30-45 anos que faturam entre 50k e 500k/mês e querem escalar sem aumentar a equipe."
            />
            <p className="text-xs text-muted-foreground">
              Quanto mais específico, mais certeira a comunicação gerada.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Pilares de conteúdo</Label>
            <TagInput
              name="pillars"
              defaultValue={voice?.content_pillars ?? []}
              placeholder="Digite um pilar e pressione Enter ou vírgula"
              hint="Cada pilar = uma entrada. Use vírgula ou Enter para separar. Ex: Autoridade → Enter → Bastidores → Enter"
            />
          </div>

          <div className="space-y-2">
            <Label>Frases características</Label>
            <TagInput
              name="phrases"
              defaultValue={voice?.characteristic_phrases ?? []}
              placeholder="Digite uma frase e pressione Enter"
              hint="Cada chip = uma expressão. Bordões, encerramentos, metáforas que você usa. Pressione Enter para adicionar."
            />
          </div>

          <div className="space-y-2">
            <Label>Palavras proibidas</Label>
            <TagInput
              name="forbidden"
              defaultValue={voice?.forbidden_words ?? []}
              placeholder="Digite uma palavra e pressione Enter ou vírgula"
              hint="Clichês de IA e expressões que não combinam com você. Vírgula ou Enter para separar."
            />
          </div>

          <Button type="submit">Salvar tom de voz</Button>
        </form>
      </CardContent>
    </Card>
  );
}
