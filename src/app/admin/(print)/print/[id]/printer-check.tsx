"use client";

import { CheckCircle2, CircleHelp, Loader2, Printer, ShieldCheck, TriangleAlert, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type State = "ok" | "warn" | "fail" | "info";
type Check = { id: string; label: string; detail: string; state: State };

type UsbDevice = { productName?: string | null; manufacturerName?: string | null; vendorId: number; productId: number };
type UsbApi = {
  getDevices: () => Promise<UsbDevice[]>;
  requestDevice: (options: { filters: { classCode: number }[] }) => Promise<UsbDevice>;
};

// Dedicated CR80 card printers take one plastic card at a time; this system prints A4 sheets of 9 cards.
const CARD_PRINTER = /evolis|fargo|\bhid\b|zebra\s*zc|magicard|datacard|entrust|nisca|swiftcolor|matica|primacy|selphy/i;

const ICON: Record<State, typeof CheckCircle2> = { ok: CheckCircle2, warn: TriangleAlert, fail: XCircle, info: CircleHelp };
const COLOR: Record<State, string> = {
  ok: "var(--success)",
  warn: "var(--st-pending)",
  fail: "var(--danger)",
  info: "var(--muted)",
};

function usbApi(): UsbApi | null {
  const api = (navigator as unknown as { usb?: UsbApi }).usb;
  return api && window.isSecureContext ? api : null;
}

function describePrinter(device: UsbDevice): Check {
  const name = [device.manufacturerName, device.productName].filter(Boolean).join(" ").trim() || "USB printer";
  if (CARD_PRINTER.test(name)) {
    return {
      id: "printer",
      label: `Printer found: ${name}`,
      state: "warn",
      detail:
        "This looks like a dedicated plastic-card printer. This system prints A4 sheets of 9 cards, which a card-only printer cannot feed. Use an A4 printer, or print the sheets and cut the cards.",
    };
  }
  return {
    id: "printer",
    label: `Printer found: ${name}`,
    state: "ok",
    detail: "A USB printer is connected. Confirm in the print dialog that it is selected and that A4 paper is loaded.",
  };
}

export default function PrinterCheck({
  online,
  fontsReady,
  missingPhotos,
  onTestPrint,
  busy,
}: {
  online: boolean;
  fontsReady: boolean;
  missingPhotos: number;
  onTestPrint: () => void;
  busy: boolean;
}) {
  const [usbSupported, setUsbSupported] = useState<boolean | null>(null);
  const [printerCheck, setPrinterCheck] = useState<Check | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    const api = usbApi();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capability is only known after mount
    setUsbSupported(Boolean(api));
    if (!api) return;
    api
      .getDevices()
      .then((devices) => {
        const known = devices.find((device) => /printer|print|laser|ink|jet/i.test(device.productName ?? ""));
        if (known) setPrinterCheck(describePrinter(known));
      })
      .catch(() => undefined);
  }, []);

  const detect = useCallback(async () => {
    const api = usbApi();
    if (!api) return;
    setScanning(true);
    try {
      const device = await api.requestDevice({ filters: [{ classCode: 7 }] });
      setPrinterCheck(describePrinter(device));
    } catch (caught) {
      const cancelled = caught instanceof DOMException && caught.name === "NotFoundError";
      setPrinterCheck({
        id: "printer",
        label: cancelled ? "No USB printer selected" : "Could not read the printer",
        state: "warn",
        detail: cancelled
          ? "No USB printer was chosen or none is connected. Network and Wi-Fi printers are not visible here; check the print dialog instead."
          : "The browser blocked access to the printer. You can still print and pick the printer in the print dialog.",
      });
    } finally {
      setScanning(false);
    }
  }, []);

  const canPrint = typeof window !== "undefined" && typeof window.print === "function";
  const checks: Check[] = [
    {
      id: "browser",
      label: canPrint ? "Browser can print" : "This browser cannot open the print dialog",
      state: canPrint ? "ok" : "fail",
      detail: canPrint ? "The print dialog is available." : "Open this page in Chrome, Edge or Firefox on a computer.",
    },
    {
      id: "network",
      label: online ? "Connected to the server" : "You are offline",
      state: online ? "ok" : "fail",
      detail: online
        ? "Progress is saved after every run."
        : "Printing is paused so progress is not lost. It resumes automatically when the connection returns.",
    },
    {
      id: "fonts",
      label: fontsReady ? "Card fonts and layout ready" : "Loading card fonts…",
      state: fontsReady ? "ok" : "info",
      detail: "Fonts must be loaded so names print at the right size.",
    },
    {
      id: "photos",
      label: missingPhotos === 0 ? "All card photos available" : `${missingPhotos} card${missingPhotos === 1 ? " has" : "s have"} no photo`,
      state: missingPhotos === 0 ? "ok" : "warn",
      detail: missingPhotos === 0 ? "Every student photo in this batch can be loaded." : "Those cards print with an empty photo area.",
    },
    printerCheck ?? {
      id: "printer",
      label: usbSupported ? "USB printer not checked yet" : "Printer cannot be detected by this browser",
      state: "info",
      detail: usbSupported
        ? "Use “Detect printer” to look for a connected USB printer."
        : "Browsers cannot list network printers for websites. Pick your printer in the print dialog, then print the test page first.",
    },
    {
      id: "paper",
      label: "Paper: A4, 100% scale, no headers or footers",
      state: "info",
      detail: "Each sheet holds 9 cards at exact CR80 size. Print the test page to confirm the 100 mm ruler measures 100 mm.",
    },
  ];

  const blocking = checks.some((check) => check.state === "fail");
  const attention = checks.some((check) => check.state === "warn");

  return (
    <section className="no-print mx-auto mb-4 max-w-4xl rounded-lg border px-4 py-4 text-sm" style={{ borderColor: "var(--line)", background: "var(--card)" }} aria-label="Printer readiness">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <ShieldCheck className="h-4 w-4" aria-hidden /> Printer readiness
        </h2>
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-bold"
          style={{
            color: blocking ? COLOR.fail : attention ? COLOR.warn : COLOR.ok,
            background: `color-mix(in srgb, ${blocking ? COLOR.fail : attention ? COLOR.warn : COLOR.ok} 14%, transparent)`,
          }}
        >
          {blocking ? "Action needed" : attention ? "Check warnings" : "Ready"}
        </span>
      </div>
      <ul className="mt-3 grid gap-2">
        {checks.map((check) => {
          const Icon = ICON[check.state];
          return (
            <li key={check.id} className="flex items-start gap-2.5">
              <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: COLOR[check.state] }} aria-hidden />
              <div className="min-w-0">
                <p className="text-xs font-semibold">{check.label}</p>
                <p className="text-muted text-xs leading-relaxed">{check.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        {usbSupported && (
          <button type="button" className="btn btn-outline btn-sm" onClick={detect} disabled={scanning}>
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Printer className="h-4 w-4" aria-hidden />}
            Detect printer
          </button>
        )}
        <button type="button" className="btn btn-outline btn-sm" onClick={onTestPrint} disabled={busy || blocking}>
          <Printer className="h-4 w-4" aria-hidden /> Print test page
        </button>
      </div>
    </section>
  );
}
