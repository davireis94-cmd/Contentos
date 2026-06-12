import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

const DARK_PHOTOS = [
  "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1080&q=85",
  "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1080&q=85",
  "https://images.unsplash.com/photo-1504639725590-34d0984388bd?auto=format&fit=crop&w=1080&q=85",
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1080&q=85",
  "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=1080&q=85",
  "https://images.unsplash.com/photo-1555099962-4199c345e5dd?auto=format&fit=crop&w=1080&q=85",
  "https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=1080&q=85",
];

function getPhoto(idx: number) {
  return DARK_PHOTOS[idx % DARK_PHOTOS.length];
}

export function stripNotes(body: string): string {
  return body.replace(/\n?\[[^\]:]+:[^\]]*\]/gi, "").trim();
}

export function extractLayout(body: string): string {
  const match = body.match(/\[Layout:\s*([a-z-]+)\]/i);
  return match?.[1]?.toLowerCase() ?? "dark";
}

function parseFeatureItems(body: string) {
  return body
    .split("\n")
    .filter((l) => l.includes("|"))
    .map((l) => {
      const [icon = "", title = "", desc = ""] = l.split("|").map((p) => p.trim());
      return { icon, title, desc };
    })
    .filter((i) => i.title);
}

function parseStepItems(body: string) {
  return body
    .split("\n")
    .filter((l) => l.includes("|"))
    .map((l) => {
      const [num = "01", title = "", desc = ""] = l.split("|").map((p) => p.trim());
      return { num, title, desc };
    })
    .filter((i) => i.title);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function progressBar(idx: number, total: number, dark: boolean): string {
  const pct = ((idx + 1) / total) * 100;
  const trackBg = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";
  const fillBg = dark ? "#fff" : "var(--brand-primary)";
  const counterColor = dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)";
  return `<div class="progress-bar">
      <div class="progress-track" style="background:${trackBg};">
        <div class="progress-fill" style="width:${pct.toFixed(1)}%;background:${fillBg};"></div>
      </div>
      <span class="progress-counter" style="color:${counterColor};">${idx + 1}/${total}</span>
    </div>`;
}

function swipeArrow(dark: boolean): string {
  const stroke = dark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.25)";
  const bg = dark
    ? "linear-gradient(to right,transparent,rgba(255,255,255,0.06))"
    : "linear-gradient(to right,transparent,rgba(0,0,0,0.05))";
  return `<div class="swipe-arrow" style="background:${bg};">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M9 6l6 6-6 6" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>`;
}

export interface SlideData {
  index: number;
  title: string;
  subtitle?: string | null;
  body?: string | null;
  cta?: string | null;
}

function buildSlide(slide: SlideData, total: number, photoIdx: number): string {
  const body = slide.body ?? "";
  const layout = extractLayout(body);
  const cleanBody = stripNotes(body);
  const isLast = slide.index === total - 1;
  const isDark = layout !== "light" && layout !== "feature-list" && layout !== "step-list";
  const prog = progressBar(slide.index, total, isDark);

  switch (layout) {
    case "dark-photo": {
      const photo = getPhoto(photoIdx);
      return `<div class="slide dark" id="slide-${slide.index}">
        <div class="img-bg"><img src="${photo}" alt="" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous"></div>
        <div class="img-overlay" style="background:linear-gradient(to top,#180E0C 35%,rgba(24,14,12,0.6) 65%,rgba(24,14,12,0.3) 100%);"></div>
        <div class="slide-content" style="padding-bottom:56px;">
          <div class="logo-lockup" style="margin-bottom:24px;">
            <div class="logo-circle avatar-photo" style="background-size:cover;background-position:center top;background-repeat:no-repeat;border:1px solid rgba(107,26,42,0.8);"></div>
            <span class="logo-name sans" style="color:rgba(255,255,255,0.6);font-size:12px;">@davimoxoto</span>
          </div>
          ${slide.subtitle ? `<span class="tag muted">${escapeHtml(slide.subtitle)}</span>` : '<span class="tag muted">IA aplicada a negócios</span>'}
          <h1 class="serif" style="color:#fff;font-size:27px;line-height:1.15;margin-bottom:10px;">${escapeHtml(slide.title)}</h1>
          ${cleanBody ? `<p class="body sans" style="color:rgba(255,255,255,0.55);font-size:13px;">${escapeHtml(cleanBody)}</p>` : ""}
        </div>
        ${prog}
        ${!isLast ? swipeArrow(true) : ""}
      </div>`;
    }
    case "gradient": {
      return `<div class="slide gradient" id="slide-${slide.index}">
        <div class="slide-content center">
          <div class="logo-lockup" style="flex-direction:column;gap:8px;margin-bottom:28px;">
            <div class="logo-circle on-gradient avatar-photo" style="width:52px;height:52px;background-size:cover;background-position:center top;background-repeat:no-repeat;"></div>
            <span class="logo-name sans" style="color:rgba(255,255,255,0.7);font-size:13px;">@davimoxoto</span>
          </div>
          ${slide.subtitle ? `<span class="tag muted">${escapeHtml(slide.subtitle)}</span>` : '<span class="tag muted">A pergunta que fica</span>'}
          <h2 class="serif" style="color:#fff;font-size:26px;margin-bottom:16px;text-align:center;">${escapeHtml(slide.title)}</h2>
          ${cleanBody ? `<p class="body sans" style="color:rgba(255,255,255,0.6);text-align:center;margin-bottom:4px;">${escapeHtml(cleanBody)}</p>` : ""}
          <div class="cta-btn">${escapeHtml(slide.cta ?? "Seguir @davimoxoto")}</div>
        </div>
        ${prog}
      </div>`;
    }
    case "light": {
      return `<div class="slide light" id="slide-${slide.index}">
        <div class="slide-content">
          ${slide.subtitle ? `<span class="tag primary">${escapeHtml(slide.subtitle)}</span>` : ""}
          <h2 class="serif" style="color:var(--dark-bg);margin-bottom:16px;">${escapeHtml(slide.title)}</h2>
          ${cleanBody ? `<p class="body sans" style="color:#4A3A34;">${escapeHtml(cleanBody)}</p>` : ""}
        </div>
        ${prog}
        ${!isLast ? swipeArrow(false) : ""}
      </div>`;
    }
    case "feature-list": {
      const items = parseFeatureItems(cleanBody);
      const rows = items.length > 0
        ? items.map((it) => `<div class="feature-row">
            <span class="feature-icon">${it.icon}</span>
            <div>
              <span class="feature-label sans">${escapeHtml(it.title)}</span>
              ${it.desc ? `<span class="feature-desc sans">${escapeHtml(it.desc)}</span>` : ""}
            </div>
          </div>`).join("")
        : `<p class="body sans" style="color:#4A3A34;">${escapeHtml(cleanBody)}</p>`;
      return `<div class="slide light" id="slide-${slide.index}">
        <div class="slide-content">
          ${slide.subtitle ? `<span class="tag primary">${escapeHtml(slide.subtitle)}</span>` : ""}
          <h2 class="serif" style="color:var(--dark-bg);margin-bottom:20px;">${escapeHtml(slide.title)}</h2>
          ${rows}
        </div>
        ${prog}
        ${!isLast ? swipeArrow(false) : ""}
      </div>`;
    }
    case "step-list": {
      const steps = parseStepItems(cleanBody);
      const rows = steps.length > 0
        ? steps.map((s) => `<div class="step-row" style="border-bottom:1px solid var(--light-border);">
            <span class="step-num" style="color:var(--brand-primary);">${escapeHtml(s.num)}</span>
            <div>
              <span class="step-title sans" style="color:var(--dark-bg);">${escapeHtml(s.title)}</span>
              ${s.desc ? `<span class="step-desc sans">${escapeHtml(s.desc)}</span>` : ""}
            </div>
          </div>`).join("")
        : `<p class="body sans" style="color:#4A3A34;">${escapeHtml(cleanBody)}</p>`;
      return `<div class="slide light" id="slide-${slide.index}">
        <div class="slide-content">
          ${slide.subtitle ? `<span class="tag primary">${escapeHtml(slide.subtitle)}</span>` : ""}
          <h2 class="serif" style="color:var(--dark-bg);margin-bottom:20px;">${escapeHtml(slide.title)}</h2>
          ${rows}
        </div>
        ${prog}
        ${!isLast ? swipeArrow(false) : ""}
      </div>`;
    }
    default: { // dark
      return `<div class="slide dark" id="slide-${slide.index}">
        <div class="slide-content">
          ${slide.subtitle ? `<span class="tag light-color">${escapeHtml(slide.subtitle)}</span>` : ""}
          <h2 class="serif" style="color:#fff;margin-bottom:12px;">${escapeHtml(slide.title)}</h2>
          ${cleanBody ? `<p class="body sans" style="color:rgba(255,255,255,0.65);">${escapeHtml(cleanBody)}</p>` : ""}
        </div>
        ${prog}
        ${!isLast ? swipeArrow(true) : ""}
      </div>`;
    }
  }
}

export function generateCarouselHtml(slides: SlideData[], title: string): string {
  const total = slides.length;
  let photoCounter = 0;
  const slidesHtml = slides.map((s) => {
    const body = s.body ?? "";
    const layout = extractLayout(body);
    const html = buildSlide(s, total, photoCounter);
    if (layout === "dark-photo") photoCounter++;
    return html;
  }).join("\n");

  const dots = Array.from({ length: total }, (_, i) =>
    `<div class="ig-dot${i === 0 ? " active" : ""}"></div>`
  ).join("\n    ");

  const slideNames = slides.map((_, i) => `"slide_${String(i + 1).padStart(2, "0")}"`).join(",");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Carrossel — ${escapeHtml(title)} | Davi Moxotó</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
:root{--brand-primary:#6B1A2A;--brand-light:#9B3A4A;--brand-dark:#3D0F18;--light-bg:#FAF7F2;--light-border:#EDE8E0;--dark-bg:#180E0C;--gradient:linear-gradient(165deg,#3D0F18 0%,#6B1A2A 50%,#9B3A4A 100%);}
body{background:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:40px 20px;font-family:'Inter',sans-serif;}
.serif{font-family:'Playfair Display',serif;}.sans{font-family:'Inter',sans-serif;}
.ig-frame{width:420px;background:#fff;border-radius:12px;box-shadow:0 24px 80px rgba(0,0,0,0.5);overflow:hidden;margin:0 auto;}
.ig-header{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #efefef;}
.ig-avatar{width:36px;height:36px;border-radius:50%;background:var(--brand-primary);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:600;flex-shrink:0;position:relative;overflow:hidden;}
.ig-handle{font-size:13px;font-weight:600;color:#262626;}.ig-subtitle{font-size:11px;color:#8e8e8e;}.ig-dots-btn{margin-left:auto;font-size:18px;color:#262626;cursor:pointer;}
.carousel-viewport{width:420px;aspect-ratio:4/5;overflow:hidden;position:relative;cursor:grab;}.carousel-viewport:active{cursor:grabbing;}
.carousel-track{display:flex;width:calc(420px * ${total});height:100%;transition:transform .35s cubic-bezier(.25,.46,.45,.94);}
.slide{width:420px;height:100%;flex-shrink:0;position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;}
.slide.light{background:var(--light-bg);}.slide.dark{background:var(--dark-bg);}.slide.gradient{background:var(--gradient);}
.slide-content{position:relative;z-index:2;padding:0 36px 56px;width:100%;}
.slide-content.center{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;height:100%;padding:36px 36px 56px;}
.tag{display:inline-block;font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;}
.tag.primary{color:var(--brand-primary);}.tag.light-color{color:var(--brand-light);}.tag.muted{color:rgba(255,255,255,0.5);}
h1,h2{font-family:'Playfair Display',serif;letter-spacing:-.3px;line-height:1.1;}
h1{font-size:30px;font-weight:700;}h2{font-size:28px;font-weight:600;}
.body{font-size:14px;line-height:1.55;}
.logo-lockup{display:flex;align-items:center;gap:10px;margin-bottom:20px;}
.logo-circle{width:40px;height:40px;border-radius:50%;background:var(--brand-primary);display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;font-weight:700;flex-shrink:0;position:relative;overflow:hidden;}
.logo-circle.on-gradient{background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);}
.logo-name{font-size:13px;font-weight:600;letter-spacing:0.5px;}
.feature-row{display:flex;align-items:flex-start;gap:14px;padding:11px 0;border-bottom:1px solid var(--light-border);}
.feature-row:last-child{border-bottom:none;}
.feature-icon{color:var(--brand-primary);font-size:16px;width:20px;text-align:center;flex-shrink:0;margin-top:2px;}
.feature-label{font-size:14px;font-weight:600;color:var(--dark-bg);display:block;}
.feature-desc{font-size:12px;color:#8A7A74;display:block;margin-top:2px;}
.step-row{display:flex;align-items:flex-start;gap:16px;padding:13px 0;}
.step-row:last-child{border-bottom:none!important;}
.step-num{font-family:'Playfair Display',serif;font-size:26px;font-weight:300;color:var(--brand-light);min-width:34px;line-height:1;}
.step-title{font-size:14px;font-weight:600;color:var(--dark-bg);display:block;}
.step-desc{font-size:12px;color:#8A7A74;display:block;margin-top:2px;}
.cta-btn{display:inline-flex;align-items:center;gap:8px;padding:12px 28px;background:var(--light-bg);color:var(--brand-dark);font-family:'Inter',sans-serif;font-weight:700;font-size:14px;border-radius:28px;margin-top:20px;}
.img-bg{position:absolute;inset:0;z-index:0;overflow:hidden;}.img-bg img{width:100%;height:100%;object-fit:cover;}
.img-overlay{position:absolute;inset:0;z-index:1;}
.progress-bar{position:absolute;bottom:0;left:0;right:0;padding:16px 28px 20px;z-index:10;display:flex;align-items:center;gap:10px;}
.progress-track{flex:1;height:3px;border-radius:2px;overflow:hidden;}
.progress-fill{height:100%;border-radius:2px;}
.progress-counter{font-size:11px;font-weight:500;}
.swipe-arrow{position:absolute;right:0;top:0;bottom:0;width:48px;z-index:9;display:flex;align-items:center;justify-content:center;}
.ig-actions{display:flex;align-items:center;padding:12px 16px 4px;gap:16px;}
.ig-action-icon{width:24px;height:24px;fill:none;stroke:#262626;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
.ig-save-icon{margin-left:auto;}
.ig-dots{display:flex;justify-content:center;gap:4px;padding:6px 0;}
.ig-dot{width:6px;height:6px;border-radius:50%;background:#dbdbdb;transition:background .2s,width .2s;}
.ig-dot.active{background:#3897f0;width:16px;border-radius:3px;}
.ig-caption{padding:4px 16px 16px;font-size:13px;color:#262626;line-height:1.4;}
.ig-caption strong{font-weight:700;}
</style>
</head>
<body>
<div id="export-ui" style="text-align:center;margin-bottom:24px;font-family:Inter,sans-serif;">
  <div style="margin-bottom:14px;">
    <label style="background:#3D0F18;color:#fff;border:none;padding:10px 24px;font-size:14px;font-weight:600;border-radius:8px;cursor:pointer;display:inline-block;">
      📷 1. Carregar foto do Davi
      <input type="file" accept="image/*" onchange="carregarFoto(this)" style="display:none;">
    </label>
    <span id="fotoStatus" style="margin-left:12px;font-size:13px;color:#8A7A74;">— selecione foto_davi.jpg</span>
  </div>
  <button id="exportBtn" onclick="exportarSlides()" style="background:#6B1A2A;color:#fff;border:none;padding:14px 36px;font-size:16px;font-weight:700;border-radius:8px;cursor:pointer;letter-spacing:0.5px;">
    ⬇ 2. Exportar ${total} slides (1080×1350)
  </button>
  <div id="exportStatus" style="margin-top:12px;font-size:13px;color:#8A7A74;min-height:20px;"></div>
</div>
<div class="ig-frame">
  <div class="ig-header">
    <div class="ig-avatar avatar-photo" style="background-size:cover;background-position:center top;background-repeat:no-repeat;"></div>
    <div><div class="ig-handle">davimoxoto</div><div class="ig-subtitle">IA aplicada a negócios</div></div>
    <span class="ig-dots-btn">···</span>
  </div>
  <div class="carousel-viewport" id="viewport">
    <div class="carousel-track" id="track">
      ${slidesHtml}
    </div>
  </div>
  <div class="ig-actions">
    <svg class="ig-action-icon" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
    <svg class="ig-action-icon" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
    <svg class="ig-action-icon" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
    <svg class="ig-action-icon ig-save-icon" viewBox="0 0 24 24"><polygon points="19 21 12 16 5 21 5 3 19 3 19 21"></polygon></svg>
  </div>
  <div class="ig-dots" id="dots">
    ${dots}
  </div>
  <div class="ig-caption">
    <strong>davimoxoto</strong> ${escapeHtml(title)} <span style="color:#3897f0;">mais</span>
  </div>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<script>
function aplicarFoto(dataUrl){document.querySelectorAll('.avatar-photo').forEach(el=>{el.style.backgroundImage='url('+dataUrl+')'});}
function carregarFoto(input){if(!input.files||!input.files[0])return;const reader=new FileReader();reader.onload=function(e){const dataUrl=e.target.result;aplicarFoto(dataUrl);try{localStorage.setItem('davimoxoto_avatar',dataUrl);}catch(e){}document.getElementById('fotoStatus').textContent='✅ Foto salva!';document.getElementById('fotoStatus').style.color='#2a6b1a';};reader.readAsDataURL(input.files[0]);}
(function(){try{const saved=localStorage.getItem('davimoxoto_avatar');if(saved){window.addEventListener('DOMContentLoaded',()=>{aplicarFoto(saved);document.getElementById('fotoStatus').textContent='✅ Foto carregada automaticamente.';document.getElementById('fotoStatus').style.color='#2a6b1a';});}}catch(e){}})();
async function exportarSlides(){const btn=document.getElementById('exportBtn');const status=document.getElementById('exportStatus');btn.disabled=true;btn.textContent='Exportando...';if(typeof html2canvas==='undefined'){status.textContent='❌ html2canvas não carregou.';btn.disabled=false;btn.textContent='⬇ Exportar novamente';return;}
const slides=document.querySelectorAll('.slide');const nomes=[${slideNames}];const SCALE=1080/420;let ok=0;const viewport=document.getElementById('viewport');const origOverflow=viewport.style.overflow;viewport.style.overflow='visible';
for(let i=0;i<slides.length;i++){status.textContent='⏳ Capturando slide '+(i+1)+' de '+slides.length+'...';try{const canvas=await html2canvas(slides[i],{scale:SCALE,useCORS:true,allowTaint:true,backgroundColor:null,width:420,height:525,logging:false,imageTimeout:10000});let dataUrl;try{dataUrl=canvas.toDataURL('image/png');}catch(e){const canvas2=await html2canvas(slides[i],{scale:SCALE,useCORS:false,allowTaint:false,backgroundColor:'#180E0C',width:420,height:525,logging:false});dataUrl=canvas2.toDataURL('image/png');}
const link=document.createElement('a');link.download=(nomes[i]||'slide_'+(i+1))+'.png';link.href=dataUrl;document.body.appendChild(link);link.click();document.body.removeChild(link);ok++;await new Promise(r=>setTimeout(r,1200));}catch(e){status.textContent='❌ Erro no slide '+(i+1)+': '+e.message;await new Promise(r=>setTimeout(r,800));}}
viewport.style.overflow=origOverflow;status.innerHTML='✅ '+ok+' de '+slides.length+' slides exportados.';status.style.color='#2a6b1a';btn.textContent='⬇ Exportar novamente';btn.disabled=false;}
const track=document.getElementById('track');const viewport=document.getElementById('viewport');const allDots=document.querySelectorAll('.ig-dot');const TOTAL=${total};const SLIDE_W=420;let current=0,startX=0,isDragging=false;
function goTo(idx){current=Math.max(0,Math.min(TOTAL-1,idx));track.style.transform='translateX('+(-current*SLIDE_W)+'px)';allDots.forEach((d,i)=>d.classList.toggle('active',i===current));}
viewport.addEventListener('mousedown',e=>{startX=e.clientX;isDragging=true;});
viewport.addEventListener('mouseup',e=>{if(!isDragging)return;isDragging=false;const diff=startX-e.clientX;if(Math.abs(diff)>40)goTo(current+(diff>0?1:-1));});
viewport.addEventListener('mouseleave',()=>{isDragging=false;});
let touchStartX=0;viewport.addEventListener('touchstart',e=>{touchStartX=e.touches[0].clientX;});
viewport.addEventListener('touchend',e=>{const diff=touchStartX-e.changedTouches[0].clientX;if(Math.abs(diff)>40)goTo(current+(diff>0?1:-1));});
allDots.forEach((d,i)=>d.addEventListener('click',()=>goTo(i)));
</script>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pieceId = searchParams.get("pieceId");
    if (!pieceId) return NextResponse.json({ error: "pieceId obrigatório" }, { status: 400 });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { data: piece, error: dbError } = await supabase
      .from("content_pieces")
      .select("title, slides, caption")
      .eq("id", pieceId)
      .single();

    if (dbError || !piece) {
      return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });
    }

    const slides = (Array.isArray(piece.slides) ? piece.slides : []) as SlideData[];
    if (slides.length === 0) {
      return NextResponse.json({ error: "Sem slides para exportar" }, { status: 400 });
    }

    const html = generateCarouselHtml(slides, piece.title ?? "Carrossel");
    const slug = (piece.title ?? "post").toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 30);

    const mode = searchParams.get("mode");
    const headers: Record<string, string> = { "Content-Type": "text/html; charset=utf-8" };
    if (mode !== "preview") {
      headers["Content-Disposition"] = `attachment; filename="carrossel_${slug}.html"`;
    }

    return new NextResponse(html, { headers });
  } catch (err) {
    console.error("[carousel] Error:", err);
    return NextResponse.json({ error: "Erro interno ao gerar carrossel" }, { status: 500 });
  }
}
