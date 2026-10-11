import QRCode from "qrcode";
import logo from "../../assets/main-logo-new.png";

export type PosterInput = {
  url: string;
  label: string;
  expiresAt: string | null;
  schoolName: string;
  address: string;
  motto: string;
};

// A4 portrait at 200 dpi, so text stays sharp when the poster is printed.
const W = 1654;
const H = 2339;
const NAVY = "#0f2a4a";
const NAVY_DEEP = "#0a1c33";
const GOLD = "#e5a823";
const INK = "#14233a";
const MUTED = "#4a5a72";
const FONT = '"Inter Variable", Inter, "Segoe UI", Arial, sans-serif';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image."));
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function formatExpiry(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric" });
  const time = d.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", hour12: true });
  return { date, time };
}

const STEPS = [
  { title: "Scan the QR code", body: "Open your phone camera, point it at the code and tap the link that appears." },
  { title: "Fill in the form", body: "Enter your details, take or upload a photo, then sign with your finger or upload your signature." },
  { title: "Submit and wait", body: "Send your application. The school will review it and update you by email." },
];

/** Draws a print-ready A4 poster (portrait) and returns it as a PNG data URL. */
export async function renderQrPoster(input: PosterInput): Promise<string> {
  await Promise.allSettled([
    document.fonts.load(`800 60px ${FONT}`),
    document.fonts.load(`700 30px ${FONT}`),
    document.fonts.load(`600 30px ${FONT}`),
    document.fonts.load(`400 30px ${FONT}`),
  ]);
  const [qrUrl, logoImg] = await Promise.all([
    QRCode.toDataURL(input.url, { width: 1000, margin: 1, errorCorrectionLevel: "M", color: { dark: NAVY_DEEP, light: "#ffffff" } }),
    loadImage(logo.src),
  ]);
  const qrImg = await loadImage(qrUrl);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser.");
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "#f4f6fa";
  ctx.fillRect(0, 0, W, H);

  // Header band
  const header = ctx.createLinearGradient(0, 0, W, 450);
  header.addColorStop(0, NAVY_DEEP);
  header.addColorStop(1, "#1d4a78");
  ctx.fillStyle = header;
  ctx.fillRect(0, 0, W, 450);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, 450, W, 12);

  const logoSize = 210;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(W / 2, 165, logoSize / 2 + 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.drawImage(logoImg, W / 2 - logoSize / 2, 165 - logoSize / 2, logoSize, logoSize);

  ctx.fillStyle = "#ffffff";
  ctx.font = `800 68px ${FONT}`;
  ctx.fillText(input.schoolName, W / 2, 358);
  ctx.fillStyle = "#f0c75e";
  ctx.font = `700 32px ${FONT}`;
  ctx.fillText("STUDENT ID ISSUANCE", W / 2, 412);

  // Title
  ctx.fillStyle = INK;
  ctx.font = `800 104px ${FONT}`;
  ctx.fillText("Apply for your", W / 2, 596);
  ctx.fillText("Student ID", W / 2, 706);
  ctx.fillStyle = MUTED;
  ctx.font = `500 38px ${FONT}`;
  ctx.fillText("Scan the QR code with your phone camera to open the application form.", W / 2, 774);

  // QR card
  const cardW = 760;
  const cardH = 790;
  const cardX = (W - cardW) / 2;
  const cardY = 830;
  ctx.save();
  ctx.shadowColor = "rgba(15, 42, 74, 0.22)";
  ctx.shadowBlur = 44;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, cardX, cardY, cardW, cardH, 40);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 7;
  roundRect(ctx, cardX, cardY, cardW, cardH, 40);
  ctx.stroke();
  ctx.drawImage(qrImg, cardX + 44, cardY + 40, cardW - 88, cardW - 88);
  ctx.fillStyle = NAVY;
  ctx.font = `800 36px ${FONT}`;
  ctx.fillText("SCAN TO APPLY", W / 2, cardY + cardH - 30);

  // Steps: each one is a card with a number, a title and a short explanation
  ctx.fillStyle = "#7a5200";
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText("HOW TO APPLY", W / 2, 1702);
  const stepW = 470;
  const stepGap = 28;
  const stepH = 300;
  const stepsX = (W - (stepW * 3 + stepGap * 2)) / 2;
  const stepsY = 1732;
  STEPS.forEach((step, i) => {
    const x = stepsX + i * (stepW + stepGap);
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, x, stepsY, stepW, stepH, 28);
    ctx.fill();
    ctx.strokeStyle = "#d6deea";
    ctx.lineWidth = 3;
    roundRect(ctx, x, stepsY, stepW, stepH, 28);
    ctx.stroke();

    ctx.fillStyle = NAVY;
    ctx.beginPath();
    ctx.arc(x + 62, stepsY + 70, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = `800 40px ${FONT}`;
    ctx.fillText(String(i + 1), x + 62, stepsY + 84);

    ctx.textAlign = "left";
    ctx.fillStyle = INK;
    ctx.font = `800 34px ${FONT}`;
    ctx.fillText(step.title, x + 118, stepsY + 82);
    ctx.fillStyle = MUTED;
    ctx.font = `500 28px ${FONT}`;
    wrap(ctx, step.body, stepW - 64)
      .slice(0, 5)
      .forEach((line, row) => ctx.fillText(line, x + 32, stepsY + 150 + row * 40));
  });
  ctx.textAlign = "center";

  // Validity strip
  const expiry = formatExpiry(input.expiresAt);
  const stripY = 2062;
  ctx.fillStyle = "#fff6dd";
  roundRect(ctx, 107, stripY, W - 214, 118, 24);
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 4;
  roundRect(ctx, 107, stripY, W - 214, 118, 24);
  ctx.stroke();
  ctx.fillStyle = "#7a5200";
  ctx.font = `700 28px ${FONT}`;
  ctx.fillText("THIS QR CODE IS VALID UNTIL", W / 2, stripY + 46);
  ctx.fillStyle = INK;
  ctx.font = `800 44px ${FONT}`;
  ctx.fillText(expiry ? `${expiry.date}  ·  ${expiry.time}` : "Until revoked by the school", W / 2, stripY + 96);

  // Footer
  ctx.fillStyle = NAVY_DEEP;
  ctx.fillRect(0, H - 130, W, 130);
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 30px ${FONT}`;
  ctx.fillText(input.motto, W / 2, H - 78);
  ctx.fillStyle = "#b9c6da";
  ctx.font = `400 25px ${FONT}`;
  const meta = [input.address, input.label].filter(Boolean).join("  ·  ");
  ctx.fillText(wrap(ctx, meta, W - 200)[0] ?? "", W / 2, H - 36);

  return canvas.toDataURL("image/png");
}
