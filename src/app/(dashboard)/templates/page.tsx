import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getSessionContext } from "@/lib/queries/context";
import { CAROUSEL_TEMPLATES } from "@/lib/templates/carousel-templates";
import { UseTemplateButton } from "@/components/templates/use-template-button";
import { Badge } from "@/components/ui/badge";

const STYLE_PREVIEW: Record<string, { bg: string; accent: string; text: string; label: string }> = {
  "editorial-light": { bg: "#FAF7F2", accent: "#6B1A2A", text: "#1A1310", label: "Creme · serif" },
  "editorial-dark":  { bg: "#1E1E1E", accent: "#6B1A2A", text: "#ffffff", label: "Grafite · serif" },
  "bold-sans":       { bg: "#0A0A0A", accent: "#6B1A2A", text: "#ffffff", label: "Preto · Anton" },
  "revista":         { bg: "#ffffff", accent: "#111111", text: "#111111", label: "Branco · uppercase" },
  "image-cards":     { bg: "#FAF7F2", accent: "#6B1A2A", text: "#1A1310", label: "Claro · foto no topo" },
};

export default async function TemplatesPage() {
  const { user, workspace, supabase } = await getSessionContext();
  if (!user) redirect("/login");
  if (!workspace) redirect("/onboarding");

  const { data: brands } = await supabase
    .from("brands")
    .select("id, name")
    .eq("workspace_id", workspace.id)
    .order("name");

  const brandList = (brands ?? []).map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Templates"
        description="Estruturas prontas baseadas nos melhores carrosséis de referência. Escolha, coloque o tema e edite."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CAROUSEL_TEMPLATES.map((tpl) => {
          const style = STYLE_PREVIEW[tpl.id] ?? STYLE_PREVIEW["editorial-light"];
          return (
            <div
              key={tpl.id}
              className="rounded-xl border bg-card overflow-hidden flex flex-col transition-shadow hover:shadow-md"
            >
              {/* Preview visual — mini-slide da capa */}
              <div
                className="h-36 flex flex-col justify-end px-5 pb-4 relative overflow-hidden"
                style={{ background: style.bg }}
              >
                {/* Linha de acento */}
                <div style={{ width: 24, height: 2, background: style.accent, marginBottom: 8 }} />
                {/* Subtítulo */}
                <div style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: style.accent,
                  marginBottom: 4,
                  opacity: 0.8,
                }}>
                  {tpl.reference}
                </div>
                {/* Título simulado */}
                <div style={{
                  fontSize: tpl.id === "bold-sans" ? 18 : 15,
                  fontWeight: 700,
                  color: style.text,
                  lineHeight: 1.1,
                  fontFamily: tpl.id === "bold-sans" ? "Impact, sans-serif" : "Georgia, serif",
                  textTransform: tpl.id === "bold-sans" || tpl.id === "revista" ? "uppercase" : "none",
                  maxWidth: "85%",
                }}>
                  {tpl.title}
                </div>
                {/* Barra progresso */}
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  padding: "8px 20px 10px",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <div style={{ flex: 1, height: 1.5, borderRadius: 1, background: style.text === "#ffffff" ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)" }}>
                    <div style={{ width: "14%", height: "100%", background: style.accent }} />
                  </div>
                  <span style={{ fontSize: 7, color: style.text === "#ffffff" ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)" }}>
                    1/{tpl.slideCount}
                  </span>
                </div>
              </div>

              {/* Info + botão */}
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="text-sm font-semibold leading-tight">{tpl.title}</p>
                      {tpl.badge && (
                        <Badge className="bg-foreground text-background text-[9px] px-1.5 py-0 border-0 shrink-0">
                          {tpl.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {tpl.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-auto pt-1">
                  <div className="flex gap-2 text-[10px] text-muted-foreground">
                    <span>{style.label}</span>
                    <span>·</span>
                    <span>{tpl.slideCount} slides</span>
                  </div>
                  <UseTemplateButton
                    templateId={tpl.id}
                    templateTitle={tpl.title}
                    brands={brandList}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
