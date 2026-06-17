import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ColorPaletteInput } from "@/components/brand/color-palette-input";
import { LogoUpload } from "@/components/brand/logo-upload";
import { AvatarUpload } from "@/components/brand/avatar-upload";
import { updateIdentity } from "../../actions";

interface IdentityTabProps {
  workspaceId: string;
  brand: {
    id: string;
    name: string;
    description: string | null;
    website: string | null;
    logo_url: string | null;
    identity: {
      colors?: string[];
      font_heading?: string | null;
      font_body?: string | null;
      avatar_url?: string | null;
      avatar_zoom?: number | null;
      avatar_x?: number | null;
      avatar_y?: number | null;
    } | null;
  };
}

export function IdentityTab({ brand, workspaceId }: IdentityTabProps) {
  const identity = brand.identity ?? {};

  return (
    <Card>
      <CardContent className="space-y-5 pt-5">
        <div className="space-y-2">
          <Label>Logotipo</Label>
          <LogoUpload
            workspaceId={workspaceId}
            brandId={brand.id}
            currentUrl={brand.logo_url}
          />
        </div>

        <div className="space-y-2">
          <Label>Foto de perfil (avatar dos carrosséis)</Label>
          <AvatarUpload
            workspaceId={workspaceId}
            brandId={brand.id}
            currentUrl={identity.avatar_url ?? null}
            currentZoom={identity.avatar_zoom ?? null}
            currentX={identity.avatar_x ?? null}
            currentY={identity.avatar_y ?? null}
          />
        </div>

        <form action={updateIdentity} className="space-y-5">
          <input type="hidden" name="brandId" value={brand.id} />

          <div className="space-y-2">
            <Label htmlFor="name">Nome da marca</Label>
            <Input id="name" name="name" defaultValue={brand.name} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={brand.description ?? ""}
              rows={3}
              placeholder="O que essa marca faz, para quem, e qual o diferencial."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Site</Label>
            <Input
              id="website"
              name="website"
              type="url"
              defaultValue={brand.website ?? ""}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label>Paleta de cores</Label>
            <ColorPaletteInput name="colors" defaultValue={identity.colors ?? []} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fontHeading">Fonte — títulos</Label>
              <Input
                id="fontHeading"
                name="fontHeading"
                defaultValue={identity.font_heading ?? ""}
                placeholder="Ex: Inter"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fontBody">Fonte — corpo</Label>
              <Input
                id="fontBody"
                name="fontBody"
                defaultValue={identity.font_body ?? ""}
                placeholder="Ex: Inter"
              />
            </div>
          </div>

          <Button type="submit">Salvar identidade</Button>
        </form>
      </CardContent>
    </Card>
  );
}
