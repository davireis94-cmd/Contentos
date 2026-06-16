import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getBrandFonts } from "@/lib/render/fonts";
import { deriveBrandTokens, type BrandTokens } from "@/lib/render/brand-tokens";
import { parseTitleHighlight } from "@/lib/render/highlight";
import {
  effectiveImageMode,
  computeImageLayout,
  type ImageMode,
} from "@/lib/render/slide-geometry";

export const runtime = "nodejs";

const W = 1080;
const H = 1350;

// ── Slide parsing ────────────────────────────────────────────────────────────
interface SlideInput {
  title: string;
  subtitle?: string | null;
  body?: string | null;
  cta?: string | null;
  imageUrl?: string | null;
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
function ProgressBar({ idx, total, dark, primary }: { idx: number; total: number; dark: boolean; primary: string }) {
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
            background: dark ? "#ffffff" : primary,
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

// ── Imagem contida (card-top / framed / half) — geometria compartilhada ───────
function renderContainedImage(
  slide: SlideInput,
  idx: number,
  total: number,
  B: BrandTokens,
  mode: ImageMode,
) {
  const G = computeImageLayout(mode, W, H);
  const img = G.image!;
  const text = cleanBody(slide.body ?? "");
  const segs = parseTitleHighlight(slide.title);
  const titleColor = "#1A1310";
  const bodyColor = "#5A4A44";

  const imageEl = (
    <div
      style={{
        display: "flex",
        position: "absolute",
        left: img.x,
        top: img.y,
        width: img.w,
        height: img.h,
        borderRadius: img.radius,
        overflow: "hidden",
        border: img.border ? `${img.border}px solid ${B.lightBorder}` : "none",
        backgroundColor: B.lightBorder,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={slide.imageUrl!}
        width={img.w}
        height={img.h}
        style={{ width: img.w, height: img.h, objectFit: "cover" }}
      />
    </div>
  );

  const textBlock = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        position: "absolute",
        left: G.text.x,
        top: G.text.y,
        width: G.text.w,
        alignItems: G.text.align === "center" ? "center" : "flex-start",
      }}
    >
      {slide.subtitle && (
        <div
          style={{
            fontSize: G.font.sub,
            fontFamily: "Inter",
            fontWeight: 600,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: B.primary,
            marginBottom: Math.round(0.018 * H),
            textAlign: G.text.align,
          }}
        >
          {slide.subtitle}
        </div>
      )}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: G.text.align === "center" ? "center" : "flex-start",
        }}
      >
        {segs.map((s, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              fontSize: G.font.title,
              fontFamily: s.hl ? "Playfair" : "Inter",
              fontStyle: s.hl ? "italic" : "normal",
              fontWeight: 700,
              lineHeight: 1.08,
              color: s.hl ? B.primary : titleColor,
              marginRight: Math.round(0.014 * W),
            }}
          >
            {s.text}
          </div>
        ))}
      </div>
      {text && (
        <div style={{ display: "flex", flexDirection: "column", marginTop: Math.round(0.025 * H) }}>
          {bodyLines(text)
            .slice(0, mode === "half" ? 5 : 3)
            .map((l, i) => (
              <div
                key={i}
                style={{
                  fontSize: G.font.body,
                  fontFamily: "Inter",
                  color: bodyColor,
                  lineHeight: 1.5,
                  marginBottom: 10,
                  textAlign: G.text.align,
                }}
              >
                {l}
              </div>
            ))}
        </div>
      )}
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: W,
        height: H,
        backgroundColor: B.lightBg,
      }}
    >
      {imageEl}
      {textBlock}
      <div
        style={{
          display: "flex",
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          alignItems: "center",
          padding: "50px 100px 70px",
        }}
      >
        <div style={{ display: "flex", flex: 1, height: 10, borderRadius: 5, background: "rgba(0,0,0,0.08)" }}>
          <div style={{ display: "flex", width: `${((idx + 1) / total) * 100}%`, height: 10, borderRadius: 5, background: B.primary }} />
        </div>
        <div style={{ display: "flex", marginLeft: 40, fontSize: 38, fontFamily: "Inter", fontWeight: 600, color: "rgba(0,0,0,0.3)" }}>
          {idx + 1}/{total}
        </div>
      </div>
    </div>
  );
}

// ── Render por layout ────────────────────────────────────────────────────────
function renderSlide(slide: SlideInput, idx: number, total: number, B: BrandTokens) {
  const body = slide.body ?? "";
  const layout = getLayout(body);
  const text = cleanBody(body);
  const isDark = layout === "dark" || layout === "dark-photo" || layout === "gradient" || layout === "editorial";

  // Imagem contida tem precedência: card no topo, emoldurada ou meia-página.
  const imgMode = effectiveImageMode(body, !!slide.imageUrl);
  if (slide.imageUrl && (imgMode === "card-top" || imgMode === "framed" || imgMode === "half")) {
    return renderContainedImage(slide, idx, total, B, imgMode);
  }

  // ── editorial (estilo capa / makemusicnow): título condensado gigante, palavra
  //    em destaque na cor da marca + sublinhado, sobre foto ou fundo escuro. ──
  if (layout === "editorial") {
    const segs = parseTitleHighlight(slide.title);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          width: W,
          height: H,
          position: "relative",
          backgroundColor: B.darkBg,
        }}
      >
        {slide.imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slide.imageUrl}
              width={W}
              height={H}
              style={{ position: "absolute", top: 0, left: 0, width: W, height: H, objectFit: "cover" }}
            />
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: W,
                height: H,
                background:
                  "linear-gradient(to bottom, rgba(10,6,5,0.15) 0%, rgba(10,6,5,0.55) 50%, rgba(10,6,5,0.94) 100%)",
              }}
            />
          </>
        ) : (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: W,
              height: H,
              background: `radial-gradient(ellipse at 70% 18%, ${B.dark} 0%, ${B.darkBg} 62%)`,
            }}
          />
        )}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            position: "relative",
            padding: "0 90px 210px",
          }}
        >
          {slide.subtitle && (
            <div
              style={{
                fontSize: 34,
                fontFamily: "Playfair",
                fontStyle: "italic",
                color: "rgba(255,255,255,0.75)",
                marginBottom: 26,
              }}
            >
              {slide.subtitle}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end" }}>
            {segs.map((s, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  fontSize: 130,
                  fontFamily: "Anton",
                  textTransform: "uppercase",
                  lineHeight: 1.0,
                  color: s.hl ? B.primary : "#ffffff",
                  marginRight: 26,
                  borderBottom: s.hl ? `12px solid ${B.primary}` : "none",
                  paddingBottom: s.hl ? 2 : 0,
                }}
              >
                {s.text}
              </div>
            ))}
          </div>
        </div>
        <ProgressBar idx={idx} total={total} dark={true} primary={B.primary} />
      </div>
    );
  }

  // ── Imagem IA de fundo (Fase 2.2) — sobrepõe texto com overlay legível ──
  if (slide.imageUrl) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          width: W,
          height: H,
          position: "relative",
          backgroundColor: B.darkBg,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={slide.imageUrl}
          width={W}
          height={H}
          style={{ position: "absolute", top: 0, left: 0, width: W, height: H, objectFit: "cover" }}
        />
        {/* Overlay gradiente para legibilidade do texto */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: W,
            height: H,
            background:
              "linear-gradient(to bottom, rgba(24,14,12,0.05) 0%, rgba(24,14,12,0.45) 55%, rgba(24,14,12,0.92) 100%)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            position: "relative",
            padding: "0 100px 200px",
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
                color: "rgba(255,255,255,0.7)",
                marginBottom: 36,
              }}
            >
              {slide.subtitle}
            </div>
          )}
          <div
            style={{
              fontSize: 88,
              fontFamily: "Playfair",
              fontWeight: 700,
              color: "#fff",
              lineHeight: 1.08,
              marginBottom: 36,
            }}
          >
            {slide.title}
          </div>
          {text && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {bodyLines(text)
                .slice(0, 3)
                .map((l, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 40,
                      fontFamily: "Inter",
                      color: "rgba(255,255,255,0.8)",
                      lineHeight: 1.5,
                      marginBottom: 12,
                    }}
                  >
                    {l}
                  </div>
                ))}
            </div>
          )}
        </div>
        <ProgressBar idx={idx} total={total} dark={true} primary={B.primary} />
      </div>
    );
  }

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
        <ProgressBar idx={idx} total={total} dark={false} primary={B.primary} />
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
        <ProgressBar idx={idx} total={total} dark={false} primary={B.primary} />
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
        <ProgressBar idx={idx} total={total} dark={false} primary={B.primary} />
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
        <ProgressBar idx={idx} total={total} dark={true} primary={B.primary} />
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
      <ProgressBar idx={idx} total={total} dark={true} primary={B.primary} />
    </div>
  );
}

// ── Handler ──────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const { slide, idx = 0, total = 1, brand } = (await request.json()) as {
      slide: SlideInput;
      idx?: number;
      total?: number;
      brand?: {
        colors?: { hex: string; role?: string }[];
        handle?: string | null;
        fontHeading?: string | null;
        fontBody?: string | null;
      };
    };

    if (!slide?.title) {
      return new Response("Slide inválido", { status: 400 });
    }

    const tokens = deriveBrandTokens(brand?.colors, brand?.handle);
    const fonts = await getBrandFonts(brand?.fontHeading, brand?.fontBody);

    return new ImageResponse(renderSlide(slide, idx, total, tokens), {
      width: W,
      height: H,
      fonts: fonts.length > 0 ? fonts : undefined,
    });
  } catch (err) {
    console.error("[render/slide] error:", err);
    return new Response("Erro ao renderizar", { status: 500 });
  }
}
