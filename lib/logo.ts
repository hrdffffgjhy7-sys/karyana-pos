import type { AppSettings } from "@/types";

// Generates a premium IAK logo PNG data URL using Canvas at runtime (no binary assets needed).
export function generateDefaultLogo(size = 256): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    const c = size / 2;
    const r = size * 0.46;

    const grad = ctx.createRadialGradient(c - size * 0.15, c - size * 0.15, size * 0.1, c, c, r);
    grad.addColorStop(0, "#16a34a");
    grad.addColorStop(1, "#14532d");
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = size * 0.03;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.round(size * 0.32)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("IAK", c, c - size * 0.02);

    ctx.font = `${Math.round(size * 0.09)}px system-ui, sans-serif`;
    ctx.fillText("KARYANA", c, c + size * 0.24);

    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}

export async function getLogo(settings: AppSettings): Promise<string> {
  if (settings.logo) return settings.logo;
  // lazy generate once
  return generateDefaultLogo();
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Templates
export function renderTemplate(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{(STORE_NAME|INVOICE_NO|ITEMS|SUBTOTAL|DISCOUNT|TOTAL|PAID|REMAINING|BALANCE|CUSTOMER_NAME)\}/g, (_m, key) =>
    String(vars[key] ?? "")
  );
}