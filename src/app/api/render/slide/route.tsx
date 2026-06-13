import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getBrandFonts } from "@/lib/render/fonts";

export const runtime = "nodejs";

// ── Brand tokens (mesmos do Studio) ──────────────────────────────────────────
const B = {
  primary: "#6B1A2A",
  light: "#9B3A4A",
  dark: "#3D0F18",
  darkBg: "#180E0C",
  lightBg: "#FAF7F2",
  lightBorder: "#EDE8E0",
  gradient: "linear-gradient(165deg,#3D0F18 0%,#6B1A2A 50%,#9B3A4A 100%)",
};

const W = 1080;
const H = 1350;

// ── Slide parsing ────────────────────────────────────────────────────────────
interface SlideInput {
  title: string;
  subtitle?: string | null;
  body?: string | null;
  cta?: string | null;
}

function getLayout(body: string): string {
  const m = body.match(/\[Layout:\s*([a-z-]+)\]/i);
  return m?.[1]?.toLowerCase() ?? "dark";
}
function cleanBody(body: string): string {
  return body.replace(/\n?\[[^\]:]+:[^\]]*\]/gi, "").trim();
}
function bodyLines(text: string): string[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}
function parseFeatures(text: string) {
  return text
    .split("\n")
    .filter((l) => l.includes("|"))
    .map((l) => {
      const [icon = "", title = "", desc = ""] = l.split("|").map((p) => p.trim());
      return { icon, title, desc };
    })
    .filter((i) => i.title)
    .slice(0, 4);
}
function parseSteps(text: string) {
  return text
    .split("\n")
    .filter((l) => l.includes("|"))
    .map((l) => {
      const [num = "01", title = "", desc = ""] = l.split("|").map((p) => p.trim());
      return { num, title, desc };
    })
    .filter((i) => i.title)
    .slice(0, 4);
}

// ── Progress bar (compartilhado) ─────────────────────────────────────────────
function ProgressBar({ idx, total, dark }: { idx: number; total: number; dark: boolean }) {
  const pct = ((idx + 1) / total) * 100;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        alignItems: "center",
        padding: "50px 100px 70px",
      }}
    >
      <div
        style={{
          display: "flex",
          flex: 1,
          height: 10,
          borderRadius: 5,
          background: dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            width: `${pct}%`,
            height: 10,
            borderRadius: 5,
            background: dark ? "#ffffff" : B.primary,
          }}
        />
      </div>
      <div
        style={{
          marginLeft: 40,
          fontSize: 38,
          fontFamily: "Inter",
          fontWeight: 600,
          color: dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)",
        }}
      >
        {idx + 1}/{total}
      </div>
    </div>
  );
}

// ── Render por layout ────────────────────────────────────────────────────────
function renderSlide(slide: SlideInput, idx: number, total: number) {
  const body = slide.body ?? "";
  const layout = getLayout(body);
  const text = cleanBody(body);
  const isDark = layout === "dark" || layout === "dark-photo" || layout === "gradient";

  const tag = (color: string) =>
    slide.subtitle ? (
      <div
        style={{
          fontSize: 32,
          fontFamily: "Inter",
          fontWeight: 600,
          letterSpacing: 6,
          textTransform: "uppercase",
          color,
          marginBottom: 36,
        }}
      >
        {slide.subtitle}
      </div>
    ) : null;

  // ── gradient (CTA) ──
  if (layout === "gradient") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: W,
          height: H,
          background: B.gradient,
          padding: "0 110px",
        }}
      >
        {slide.subtitle && (
          <div
            style={{
              fontSize: 32,
              fontFamily: "Inter",
              fontWeight: 600,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.5)",
              marginBottom: 40,
            }}
          >
            {slide.subtitle}
          </div>
        )}
        <div
          style={{
            fontSize: 92,
            fontFamily: "Playfair",
            fontWeight: 700,
            color: "#fff",
            lineHeight: 1.12,
            textAlign: "center",
            marginBottom: 44,
          }}
        >
          {slide.title}
        </div>
        {text && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              fontSize: 40,
              fontFamily: "Inter",
              color: "rgba(255,255,255,0.7)",
              lineHeight: 1.5,
              textAlign: "center",
              marginBottom: 56,
            }}
          >
            {bodyLines(text).slice(0, 3).map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        )}
        <div
          style={{
            display: "flex",
            padding: "32px 64px",
            background: B.lightBg,
            color: B.dark,
            borderRadius: 100,
            fontSize: 40,
            fontFamily: "Inter",
            fontWeight: 600,
          }}
        >
          {slide.cta ?? "Seguir para mais"}
        </div>
      </div>
    );
  }

  // ── feature-list ──
  if (layout === "feature-list") {
    const items = parseFeatures(text);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          width: W,
          height: H,
          background: B.lightBg,
          padding: "0 100px 200px",
        }}
      >
        {tag(B.primary)}
        <div
          style={{
            fontSize: 76,
            fontFamily: "Playfair",
            fontWeight: 700,
            color: B.darkBg,
            lineHeight: 1.12,
            marginBottom: 56,
          }}
        >
          {slide.title}
        </div>
        {items.map((it, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              padding: "32px 0",
              borderBottom: i < items.length - 1 ? `2px solid ${B.lightBorder}` : "none",
            }}
          >
            <div style={{ display: "flex", fontSize: 52, marginRight: 36, color: B.primary }}>
              {it.icon}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 42, fontFamily: "Inter", fontWeight: 600, color: B.darkBg }}>
                {it.title}
              </div>
              {it.desc && (
                <div style={{ fontSize: 34, fontFamily: "Inter", color: "#8A7A74", marginTop: 6 }}>
                  {it.desc}
                </div>
              )}
            </div>
          </div>
        ))}
        <ProgressBar idx={idx} total={total} dark={false} />
      </div>
    );
  }

  // ── step-list ──
  if (layout === "step-list") {
    const steps = parseSteps(text);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          width: W,
          height: H,
          background: B.lightBg,
          padding: "0 100px 200px",
        }}
      >
        {tag(B.primary)}
        <div
          style={{
            fontSize: 76,
            fontFamily: "Playfair",
            fontWeight: 700,
            color: B.darkBg,
            lineHeight: 1.12,
            marginBottom: 56,
          }}
        >
          {slide.title}
        </div>
        {steps.map((s, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              padding: "32px 0",
              borderBottom: i < steps.length - 1 ? `2px solid ${B.lightBorder}` : "none",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 88,
                fontFamily: "Playfair",
                fontWeight: 700,
                color: B.light,
                marginRight: 44,
                minWidth: 120,
              }}
            >
              {s.num}
            </div>
            <div style={{ display: "flex", flexDirection: "column", paddingTop: 14 }}>
              <div style={{ fontSize: 42, fontFamily: "Inter", fontWeight: 600, color: B.darkBg }}>
                {s.title}
              </div>
              {s.desc && (
                <div style={{ fontSize: 34, fontFamily: "Inter", color: "#8A7A74", marginTop: 6 }}>
                  {s.desc}
                </div>
              )}
            </div>
          </div>
        ))}
        <ProgressBar idx={idx} total={total} dark={false} />
      </div>
    );
  }

  // ── light ──
  if (layout === "light") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          width: W,
          height: H,
          background: B.lightBg,
          padding: "0 100px 200px",
        }}
      >
        {tag(B.primary)}
        <div
          style={{
            fontSize: 84,
            fontFamily: "Playfair",
            fontWeight: 700,
            color: B.darkBg,
            lineHeight: 1.1,
            marginBottom: 44,
          }}
        >
          {slide.title}
        </div>
        {text && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {bodyLines(text).map((l, i) => (
              <div
                key={i}
                style={{
                  fontSize: 42,
                  fontFamily: "Inter",
                  color: "#4A3A34",
                  lineHeight: 1.5,
                  marginBottom: 14,
                }}
              >
                {l}
              </div>
            ))}
          </div>
        )}
        <ProgressBar idx={idx} total={total} dark={false} />
      </div>
    );
  }

  // ── dark-photo (fundo simulado — imagem IA entra na etapa 2) ──
  if (layout === "dark-photo") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          width: W,
          height: H,
          background:
            "linear-gradient(160deg,#2a1810 0%,#1a0e0c 45%,#180E0C 100%)",
          padding: "0 100px 200px",
        }}
      >
        {tag("rgba(255,255,255,0.5)")}
        <div
          style={{
            fontSize: 84,
            fontFamily: "Playfair",
            fontWeight: 700,
            color: "#fff",
            lineHeight: 1.1,
            marginBottom: 36,
          }}
        >
          {slide.title}
        </div>
        {text && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {bodyLines(text).slice(0, 3).map((l, i) => (
              <div
                key={i}
                style={{
                  fontSize: 40,
                  fontFamily: "Inter",
                  color: "rgba(255,255,255,0.55)",
                  lineHeight: 1.5,
                  marginBottom: 12,
                }}
              >
                {l}
              </div>
            ))}
          </div>
        )}
        <ProgressBar idx={idx} total={total} dark={true} />
      </div>
    );
  }

  // ── dark (default) ──
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        width: W,
        height: H,
        background: B.darkBg,
        padding: "0 100px 200px",
      }}
    >
      {tag(B.light)}
      <div
        style={{
          fontSize: 84,
          fontFamily: "Playfair",
          fontWeight: 700,
          color: "#fff",
          lineHeight: 1.1,
          marginBottom: 44,
        }}
      >
        {slide.title}
      </div>
      {text && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {bodyLines(text).map((l, i) => (
            <div
              key={i}
              style={{
                fontSize: 42,
                fontFamily: "Inter",
                color: "rgba(255,255,255,0.6)",
                lineHeight: 1.5,
                marginBottom: 14,
              }}
            >
              {l}
            </div>
          ))}
        </div>
      )}
      <ProgressBar idx={idx} total={total} dark={true} />
    </div>
  );
}

// ── Handler ──────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const { slide, idx = 0, total = 1 } = (await request.json()) as {
      slide: SlideInput;
      idx?: number;
      total?: number;
    };

    if (!slide?.title) {
      return new Response("Slide inválido", { status: 400 });
    }

    const fonts = await getBrandFonts();

    return new ImageResponse(renderSlide(slide, idx, total), {
      width: W,
      height: H,
      fonts: fonts.length > 0 ? fonts : undefined,
    });
  } catch (err) {
    console.error("[render/slide] error:", err);
    return new Response("Erro ao renderizar", { status: 500 });
  }
}
