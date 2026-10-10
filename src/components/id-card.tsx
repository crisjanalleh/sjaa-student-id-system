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

function SchoolLogo({ className = "" }: { className?: string }) {
  return <SjaaLogo className={`sjaa-card-logo object-contain ${className}`} />;
}

const BLUE = "#1d4f9c";
const YELLOW = "#f3d533";
const SERIF = "Cambria, Georgia, 'Times New Roman', serif";

/** Senior High (Grade 11-12) IDs carry two validation years; Junior High IDs carry four. */
export function isSeniorHigh(gradeLevel: string): boolean {
  return /^grade\s*(11|12)$/i.test(gradeLevel.trim());
}

function BottomWave() {
  return (
    <svg className="sjaa-card-art" viewBox="0 0 53.98 85.6" preserveAspectRatio="none" aria-hidden="true">
      <path
        fill={YELLOW}
        d="M0 79.4C12 77.4 24 82.4 34 83.2C44 84 50 80.4 53.98 77.8V80.6C50 83 44 86.6 34 86.2C24 85.8 12 81.4 0 82Z"
      />
      <path fill={BLUE} d="M0 82C12 81.4 24 85.8 34 86.2C44 86.6 50 83 53.98 80.6V85.6H0Z" />
      <path fill={BLUE} d="M0 79.8C9 78.4 18 80.6 26 81.2C18 83.4 8 84.2 0 83.6Z" />
    </svg>
  );
}

function FrontArt() {
  return (
    <svg className="sjaa-card-art" viewBox="0 0 53.98 85.6" preserveAspectRatio="none" aria-hidden="true">
      <rect width="53.98" height="85.6" fill="#fbfaf4" />
      <path d="M0 0H53.98V5.2C46 3.4 40 9.2 30 9.6C21 9.9 15 5.6 0 8.4Z" fill={BLUE} />
      <path
        d="M0 8.4C15 5.6 21 9.9 30 9.6C40 9.2 46 3.4 53.98 5.2V6.6C46 5.2 40 10.8 30 11C21 11.2 15 7.4 0 10Z"
        fill={YELLOW}
      />
      <path d="M26 11.4C36 10.6 46 9.8 53.98 6.8V10.8C46 12 36 11.8 26 11.4Z" fill={BLUE} />
      <rect y="13.6" width="53.98" height="8.3" fill={BLUE} />
    </svg>
  );
}

function BackArt() {
  return (
    <svg className="sjaa-card-art" viewBox="0 0 53.98 85.6" preserveAspectRatio="none" aria-hidden="true">
      <rect width="53.98" height="85.6" fill="#fbfaf4" />
      <path d="M0 0H53.98V4.4C47 3.4 42 6.8 35 8.4C27 10.2 21 11.8 14 10.2C8 8.8 4 7.6 0 8.2Z" fill={BLUE} />
      <path
        d="M0 8.2C4 7.6 8 8.8 14 10.2C21 11.8 27 10.2 35 8.4C42 6.8 47 3.4 53.98 4.4V5.8C47 4.8 42 8.2 35 9.8C27 11.6 21 13.2 14 11.6C8 10.2 4 9 0 9.6Z"
        fill={YELLOW}
      />
      <path d="M29.7 9.4C38 7.2 46 6.4 53.98 6.6V11.2C46 11.4 38 11 29.7 9.4Z" fill={BLUE} />
      <circle cx="44.2" cy="8.4" r="5.4" fill="#d3e5f6" stroke="#5d90c6" strokeWidth="0.35" />
      <text
        x="44.2"
        y="9.9"
        textAnchor="middle"
        fontSize="4.2"
        fontWeight="900"
        fontStyle="italic"
        fill="#2b5c9c"
        fontFamily="Arial, sans-serif"
      >
        ESC
      </text>
    </svg>
  );
}

function validationYears(schoolYear: string, count: number): string[] {
  const startYear = Number(schoolYear.match(/\d{4}/)?.[0]);
  const first = Number.isInteger(startYear) ? startYear : new Date().getFullYear();
  return Array.from({ length: count }, (_, index) => {
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
        <FrontArt />
        <SchoolLogo className="sjaa-front-logo" />
        <svg className="sjaa-card-art" viewBox="0 0 53.98 85.6" aria-hidden="true">
          <g
            fontFamily="'Arial Rounded MT Bold','Trebuchet MS',Verdana,sans-serif"
            fontWeight="900"
            fill="#f7e03c"
            stroke="#4a4a12"
            strokeWidth="0.3"
            strokeLinejoin="round"
            paintOrder="stroke"
            fontSize="3.7"
          >
            <text x="13.1" y="5.7" textLength="38.3" lengthAdjust="spacingAndGlyphs">SAN JOSE ADVENTIST</text>
            <text x="19.1" y="9.4" textLength="26.8" lengthAdjust="spacingAndGlyphs">ACADEMY INC.</text>
          </g>
          <text
            x="13.3"
            y="12.7"
            textLength="37.5"
            lengthAdjust="spacingAndGlyphs"
            fontSize="2.9"
            fontStyle="italic"
            fontWeight="700"
            fill="#c8372d"
            fontFamily="'Segoe Script','Brush Script MT',Georgia,serif"
          >
            &ldquo;The school that trains for service.&rdquo;
          </text>
          <g fill="#ffffff" fontFamily={SERIF} fontWeight="700" fontSize="2.45">
            <text x="2.6" y="16.3" textLength="47" lengthAdjust="spacingAndGlyphs">
              V. Mariano St., San Roque 2, San Jose, Occ. Mindoro
            </text>
            <text x="15.5" y="18.5" textLength="21.6" lengthAdjust="spacingAndGlyphs">Tel. No.: (043) 491 - 2579</text>
            <text x="8.8" y="20.8" textLength="34.6" lengthAdjust="spacingAndGlyphs">
              Email Address: sjaa_sjaes@yahoo.com
            </text>
          </g>
          <text
            x="6.4"
            y="25.8"
            textLength="42.2"
            lengthAdjust="spacingAndGlyphs"
            fontSize="4"
            fontWeight="900"
            fill="#2a2a2a"
            fontFamily={SERIF}
          >
            {isSeniorHigh(data.gradeLevel) ? "SENIOR HIGH SCHOOL" : "JUNIOR HIGH SCHOOL"}
          </text>
        </svg>
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
          <span>LRN:</span>
          <b>{data.studentIdNumber}</b>
        </div>
        <div className="sjaa-student-signature">
          {data.studentSignatureDataUrl && (
            // The normalized signature is held in the private application record.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.studentSignatureDataUrl} alt="" />
          )}
          <span className="sjaa-student-signature-label">Student Signature</span>
        </div>
        <BottomWave />
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
  const years = validationYears(template.schoolYear, isSeniorHigh(data.gradeLevel) ? 2 : 4);
  if (template.orientation === "portrait") {
    return (
      <div
        className="id-card id-card-portrait"
        style={cardSize(template.orientation)}
        data-orientation={template.orientation}
        aria-label="ID card back"
      >
        <BackArt />
        <svg className="sjaa-card-art" viewBox="0 0 53.98 85.6" aria-hidden="true">
          <g fill="#3a3a3a" fontFamily={SERIF} fontSize="2.9">
            <text x="4" y="16.7" textLength="47.8" lengthAdjust="spacingAndGlyphs">
              In case of emergency or loss of this
            </text>
            <text x="7.7" y="20.5" textLength="39.9" lengthAdjust="spacingAndGlyphs">
              School ID, PLEASE CONTACT:
            </text>
          </g>
        </svg>
        {template.showEmergencyContact && (
          <div className="sjaa-back-contact-list">
            <div className="sjaa-back-contact sjaa-back-contact-name">
              <UserRound aria-hidden />
              <strong>{data.emergencyContactName}</strong>
            </div>
            <div className="sjaa-back-contact sjaa-back-contact-address">
              <House aria-hidden />
              <span>{data.address}</span>
            </div>
            <div className="sjaa-back-contact sjaa-back-contact-phone">
              <Phone aria-hidden />
              <span>{data.emergencyContactPhone}</span>
            </div>
          </div>
        )}
        <h3 className="sjaa-validation-title">VALIDATION:</h3>
        <table className={`sjaa-validation-table ${years.length > 2 ? "is-four-year" : ""}`}>
          <thead>
            <tr>
              <th />
              <th>First Sem</th>
              <th>Second Sem</th>
            </tr>
          </thead>
          <tbody>
            {years.map((year, index) => (
              <tr key={year}>
                <th scope="row">{year}</th>
                <td>{index === 0 && <SchoolLogo />}</td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>
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
        <BottomWave />
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
  emergencyContactName: "Maria S. Dela Cruz",
  emergencyContactPhone: "0917 123 4567",
  address: "Mabini, San Jose, Occidental Mindoro",
  studentSignatureDataUrl: null,
};
