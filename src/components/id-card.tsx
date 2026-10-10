"use client";

import type { AdminTemplateConfig } from "@/db/schema";
import type { CSSProperties } from "react";
import { House, Phone, UserRound } from "lucide-react";
import SjaaLogo from "@/components/sjaa-logo";

export type IdCardData = {
  controlNo: string;
  studentIdNumber: string;
  fullNameLine: string;
  gradeLevel: string;
  trackStrand: string | null;
  bloodType: string | null;
  emergencyContactName: string;
  emergencyContactPhone: string;
  address: string;
  studentSignatureDataUrl: string | null;
};

const MM = 3.7795275591; // CSS px per millimetre at 96dpi
const LANDSCAPE_SIZE = { width: 85.6, height: 53.98 };
const PORTRAIT_SIZE = { width: 53.98, height: 85.6 };

function cardSize(orientation: AdminTemplateConfig["orientation"]) {
  const size = orientation === "portrait" ? PORTRAIT_SIZE : LANDSCAPE_SIZE;
  return { width: `${size.width}mm`, height: `${size.height}mm` };
}

function signatorySignatureStyle(template: AdminTemplateConfig): CSSProperties {
  const design = template.designSettings;
  return {
    width: `${30 * design.signatoryScale}mm`,
    maxWidth: `${30 * design.signatoryScale}mm`,
    height: `${8 * design.signatoryScale}mm`,
    transform: `translate(${design.signatoryOffsetX}mm, ${design.signatoryOffsetY}mm)`,
    transformOrigin: "center bottom",
  };
}

function SchoolLogo() {
  return <SjaaLogo className="sjaa-card-logo h-[8.5mm] w-[8.5mm] shrink-0 object-contain" />;
}

function CardWave() {
  return (
    <svg className="sjaa-card-wave" viewBox="0 0 540 100" preserveAspectRatio="none" aria-hidden="true">
      <path fill="#f0c52f" d="M0 39C115 92 206 58 297 30c95-29 148-22 243 10v60H0Z" />
      <path fill="#07539a" d="M0 59c104 34 190 30 294 0 105-31 168-31 246-7v48H0Z" />
    </svg>
  );
}

function validationYears(schoolYear: string): string[] {
  const startYear = Number(schoolYear.match(/\d{4}/)?.[0]);
  const first = Number.isInteger(startYear) ? startYear : new Date().getFullYear();
  return Array.from({ length: 4 }, (_, index) => {
    const start = first + index;
    return `${start} - ${start + 1}`;
  });
}

function CardFront({
  data,
  template,
  photoUrl,
}: {
  data: IdCardData;
  template: AdminTemplateConfig;
  photoUrl?: string | null;
}) {
  const design = template.designSettings;
  const photoTransform = `translate(${design.photoOffsetX}mm, ${design.photoOffsetY}mm) scale(${design.photoScale})`;
  const nameTransform = `translate(${design.nameOffsetX}mm, ${design.nameOffsetY}mm)`;
  if (template.orientation === "portrait") {
    return (
      <div
        className="id-card id-card-portrait"
        style={cardSize(template.orientation)}
        data-orientation={template.orientation}
        aria-label="ID card front"
      >
        <div className="sjaa-front-header">
          <div className="sjaa-front-brand">
            <SchoolLogo />
            <div className="sjaa-front-school-name">SAN JOSE ADVENTIST<br />ACADEMY INC.</div>
          </div>
          <div className="sjaa-front-motto">&ldquo;The School that Trains for Service.&rdquo;</div>
          <div className="sjaa-front-location">San Jose, Occidental Mindoro</div>
        </div>
        <div className="sjaa-front-level">
          {data.gradeLevel === "Grade 11" || data.gradeLevel === "Grade 12"
            ? "SENIOR HIGH SCHOOL"
            : "JUNIOR HIGH SCHOOL"}
        </div>
        <div className="sjaa-front-body">
          <div className="sjaa-front-photo" style={{ transform: photoTransform }}>
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="Student" />
            ) : (
              <svg width="14mm" height="14mm" viewBox="0 0 24 24" fill="#94A3B8" aria-hidden>
                <path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.3 0-9.8 1.7-9.8 4.9v2.5h19.6v-2.5c0-3.2-6.5-4.9-9.8-4.9z" />
              </svg>
            )}
          </div>
          <div className="sjaa-front-name" style={{ fontSize: `${design.nameFontSize}px`, transform: nameTransform }}>
            {data.fullNameLine}
          </div>
          <div className="sjaa-front-lrn">
            <span>LRN:</span> {data.studentIdNumber}
          </div>
          <div className="sjaa-student-signature">
            {data.studentSignatureDataUrl && (
              // The normalized signature is held in the private application record.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.studentSignatureDataUrl} alt="" />
            )}
            <span className="sjaa-student-signature-line" />
            <span className="sjaa-student-signature-label">Student Signature</span>
          </div>
        </div>
        <CardWave />
      </div>
    );
  }

  return (
    <div
      className="id-card"
      style={cardSize(template.orientation)}
      data-orientation={template.orientation}
      aria-label="ID card front"
    >
      {/* Header band */}
      <div
        style={{
          height: "12.5mm",
          background: "#1B2A4A",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          gap: "2mm",
          padding: "1.2mm 2.4mm",
        }}
      >
        <SchoolLogo />
        <div style={{ lineHeight: 1.15, minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: "8.5px", fontWeight: 800, letterSpacing: "0.2px" }}>
            SAN JOSE ADVENTIST ACADEMY
          </div>
          <div style={{ fontSize: "5.6px", color: "#CBD5E1", fontStyle: "italic" }}>
            &ldquo;The School that Trains for Service.&rdquo;
          </div>
          <div style={{ fontSize: "5.6px", color: "#94A3B8" }}>
            San Jose, Occ. Mindoro &middot; Est. 1996
          </div>
        </div>
        <div
          style={{
            textAlign: "center",
            background: "#E5A823",
            color: "#1B2A4A",
            borderRadius: "1mm",
            padding: "0.9mm 1.6mm",
            fontSize: "5.8px",
            fontWeight: 800,
            lineHeight: 1.2,
          }}
        >
          S.Y.
          <br />
          {template.schoolYear}
        </div>
      </div>

      {/* Body */}
      <div style={{ display: "flex", gap: "2.4mm", padding: "2.6mm 2.4mm 0" }}>
        {/* Photo (2x2 portrait area) */}
        <div
          style={{
            width: "22mm",
            height: "28mm",
            border: "0.35mm solid #CBD5E1",
            borderRadius: "0.8mm",
            overflow: "hidden",
            background: "#F1F5F9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transform: photoTransform,
          }}
        >
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt="Student"
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
            />
          ) : (
            <svg width="14mm" height="14mm" viewBox="0 0 24 24" fill="#94A3B8" aria-hidden>
              <path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.3 0-9.8 1.7-9.8 4.9v2.5h19.6v-2.5c0-3.2-6.5-4.9-9.8-4.9z" />
            </svg>
          )}
        </div>

        {/* Identity */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: `${5.4 * design.detailFontScale}px`, fontWeight: 700, color: "#64748B", letterSpacing: "0.5px" }}>
            STUDENT NAME
          </div>
          <div
            style={{
              fontSize: `${design.nameFontSize}px`,
              fontWeight: 800,
              color: "#0F172A",
              textTransform: "uppercase",
              lineHeight: 1.2,
              marginTop: "0.4mm",
              wordBreak: "break-word",
              transform: nameTransform,
            }}
          >
            {data.fullNameLine}
          </div>
          <div style={{ height: "0.45mm", background: "#E5A823", width: "16mm", margin: "1.1mm 0 1.4mm" }} />

          <div style={{ display: "flex", gap: "3mm" }}>
            <div>
              <div style={{ fontSize: `${5.4 * design.detailFontScale}px`, fontWeight: 700, color: "#64748B", letterSpacing: "0.5px" }}>
                STUDENT ID / LRN
              </div>
              <div style={{ fontSize: `${8 * design.detailFontScale}px`, fontWeight: 700, fontFamily: "Consolas, monospace", color: "#1B2A4A" }}>
                {data.studentIdNumber}
              </div>
            </div>
            <div>
              <div style={{ fontSize: `${5.4 * design.detailFontScale}px`, fontWeight: 700, color: "#64748B", letterSpacing: "0.5px" }}>
                {template.showTrackStrand && data.trackStrand ? "GRADE / TRACK" : "GRADE LEVEL"}
              </div>
              <div style={{ fontSize: `${7.6 * design.detailFontScale}px`, fontWeight: 700, color: "#0F172A" }}>
                {data.gradeLevel}
                {template.showTrackStrand && data.trackStrand
                  ? ` · ${data.trackStrand.split("—")[0].trim()}`
                  : ""}
              </div>
            </div>
          </div>

          <div style={{ marginTop: "1.6mm", fontSize: `${6 * design.detailFontScale}px`, color: "#64748B", fontFamily: "Consolas, monospace" }}>
            {data.controlNo}
          </div>
        </div>
      </div>

      {/* Footer strip */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "4.6mm",
          background: "#254E70",
          color: "#E2E8F0",
          display: "flex",
          alignItems: "center",
          padding: "0 2.4mm",
          fontSize: "5.6px",
          letterSpacing: "0.4px",
          fontWeight: 600,
        }}
      >
        STUDENT IDENTIFICATION CARD
        <span style={{ marginLeft: "auto", color: "#E5A823" }}>SJAA</span>
      </div>
    </div>
  );
}

function CardBack({
  data,
  template,
}: {
  data: IdCardData;
  template: AdminTemplateConfig;
}) {
  if (template.orientation === "portrait") {
    return (
      <div
        className="id-card id-card-portrait"
        style={cardSize(template.orientation)}
        data-orientation={template.orientation}
        aria-label="ID card back"
      >
        <div className="sjaa-back-header">
          <div className="sjaa-back-header-text">SAN JOSE ADVENTIST ACADEMY INC.</div>
          <SchoolLogo />
        </div>
        <div className="sjaa-back-body">
          <h2 className="sjaa-back-instructions">
            In case of emergency or loss of this School ID, please contact:
          </h2>
          {template.showEmergencyContact && (
            <div className="sjaa-back-contact-list">
              <div className="sjaa-back-contact">
                <UserRound aria-hidden />
                <strong>{data.emergencyContactName}</strong>
              </div>
              <div className="sjaa-back-contact">
                <House aria-hidden />
                <span>{data.address}</span>
              </div>
              <div className="sjaa-back-contact">
                <Phone aria-hidden />
                <span>{data.emergencyContactPhone}</span>
              </div>
            </div>
          )}
          <h3 className="sjaa-validation-title">VALIDATION</h3>
          <table className="sjaa-validation-table">
            <thead>
              <tr>
                {validationYears(template.schoolYear).map((year) => (
                  <th key={year}>{year}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {validationYears(template.schoolYear).map((year, index) => (
                  <td key={year}>
                    {index === 0 && <SchoolLogo />}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="sjaa-principal-signature">
          {template.designSettings.signatorySignature && (
            // Signature data is normalized to a bounded, re-encoded PNG by the template API.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={template.designSettings.signatorySignature}
              alt=""
              style={signatorySignatureStyle(template)}
            />
          )}
          <strong>{template.signatoryName || " "}</strong>
          <span>{template.signatoryTitle || "SCHOOL PRINCIPAL"}</span>
        </div>
        <CardWave />
      </div>
    );
  }

  return (
    <div
      className="id-card"
      style={cardSize(template.orientation)}
      data-orientation={template.orientation}
      aria-label="ID card back"
    >
      <div
        style={{
          height: "7mm",
          background: "#E5A823",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#1B2A4A",
          fontSize: "6.6px",
          fontWeight: 800,
          letterSpacing: "1.2px",
        }}
      >
        SAN JOSE ADVENTIST ACADEMY
      </div>

      <div style={{ padding: "2.2mm 3mm", fontSize: "6.6px", color: "#0F172A" }}>
        {template.showEmergencyContact && (
          <div style={{ marginBottom: "1.6mm" }}>
            <div style={{ fontSize: "5.4px", fontWeight: 700, color: "#64748B", letterSpacing: "0.5px" }}>
              IN CASE OF EMERGENCY, PLEASE NOTIFY
            </div>
            <div style={{ fontSize: "7.4px", fontWeight: 700 }}>{data.emergencyContactName}</div>
            <div style={{ fontSize: "6.6px", color: "#334155", fontFamily: "Consolas, monospace" }}>
              {data.emergencyContactPhone}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: "4mm" }}>
          {template.showBloodType && (
            <div>
              <div style={{ fontSize: "5.4px", fontWeight: 700, color: "#64748B", letterSpacing: "0.5px" }}>
                BLOOD TYPE
              </div>
              <div
                style={{
                  display: "inline-block",
                  border: "0.3mm solid #B91C1C",
                  color: "#B91C1C",
                  borderRadius: "0.8mm",
                  fontWeight: 800,
                  fontSize: "7px",
                  padding: "0.5mm 1.6mm",
                  marginTop: "0.4mm",
                }}
              >
                {data.bloodType || "—"}
              </div>
            </div>
          )}
          {template.showTrackStrand && data.trackStrand && (
            <div>
              <div style={{ fontSize: "5.4px", fontWeight: 700, color: "#64748B", letterSpacing: "0.5px" }}>
                TRACK / STRAND
              </div>
              <div style={{ fontSize: "6.8px", fontWeight: 700, marginTop: "0.4mm" }}>{data.trackStrand}</div>
            </div>
          )}
        </div>

        {/* Signatory */}
        <div className="landscape-signatory">
          {template.designSettings.signatorySignature && (
            // Signature data is normalized to a bounded, re-encoded PNG by the template API.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="signatory-signature"
              src={template.designSettings.signatorySignature}
              alt=""
              style={signatorySignatureStyle(template)}
            />
          )}
          <div style={{ width: "34mm", borderBottom: "0.3mm solid #334155", height: "4.5mm" }} />
          <div style={{ fontSize: "6.8px", fontWeight: 800, textTransform: "uppercase" }}>
            {template.signatoryName || " "}
          </div>
          <div style={{ fontSize: "5.6px", color: "#64748B" }}>{template.signatoryTitle || " "}</div>
        </div>

        <div style={{ position: "absolute", left: "3mm", bottom: "7mm", fontSize: "5.6px", color: "#64748B", lineHeight: 1.5 }}>
          Control No.: <span style={{ fontFamily: "Consolas, monospace" }}>{data.controlNo}</span>
          <br />
          School Year: {template.schoolYear}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "4.6mm",
          background: "#1B2A4A",
          color: "#CBD5E1",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "5.4px",
          letterSpacing: "0.3px",
          fontStyle: "italic",
          padding: "0 2mm",
          textAlign: "center",
        }}
      >
        &ldquo;The School that Trains for Service.&rdquo; &middot; San Jose, Occ. Mindoro &middot; Est. 1996
      </div>
    </div>
  );
}

export function IdCard({
  data,
  template,
  variant,
  photoUrl,
}: {
  data: IdCardData;
  template: AdminTemplateConfig;
  variant: "front" | "back";
  photoUrl?: string | null;
}) {
  const portraitTemplate: AdminTemplateConfig =
    template.orientation === "portrait"
      ? template
      : { ...template, orientation: "portrait" };
  return variant === "front" ? (
    <CardFront data={data} template={portraitTemplate} photoUrl={photoUrl} />
  ) : (
    <CardBack data={data} template={portraitTemplate} />
  );
}

/** Screen preview helper: renders the exact-mm card scaled for viewing. */
export function ScaledIdCard({
  scale = 2,
  template,
  ...cardProps
}: {
  scale?: number;
  data: IdCardData;
  template: AdminTemplateConfig;
  variant: "front" | "back";
  photoUrl?: string | null;
}) {
  const dimensions = PORTRAIT_SIZE;
  const w = dimensions.width * MM * scale;
  const h = dimensions.height * MM * scale;
  return (
    <div style={{ width: w, height: h, maxWidth: "100%", overflow: "visible" }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <IdCard {...cardProps} template={template} />
      </div>
    </div>
  );
}

export const SAMPLE_CARD_DATA: IdCardData = {
  controlNo: "SJAA-26-SAMPLE",
  studentIdNumber: "123456789012",
  fullNameLine: "DELA CRUZ, JUAN A. JR.",
  gradeLevel: "Grade 11",
  trackStrand: "STEM — Science, Technology, Engineering and Mathematics",
  bloodType: "O+",
  emergencyContactName: "Maria S. Dela Cruz",
  emergencyContactPhone: "0917 123 4567",
  address: "Mabini, San Jose, Occidental Mindoro",
  studentSignatureDataUrl: null,
};
