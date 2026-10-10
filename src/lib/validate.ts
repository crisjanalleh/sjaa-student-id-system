import "server-only";
import { BLOOD_TYPES, GRADE_LEVELS, TRACK_STRANDS } from "@/lib/fields";

export type FieldErrors = Record<string, string>;

export function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function cleanMultiline(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKC")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const PHONE_RE = /^[+0-9][0-9 ()-]{5,24}$/;
const NAME_RE = /^[A-Za-zÑñ][A-Za-zÑñ .'-]*$/;

export function validateApplicationFields(input: Record<string, unknown>): {
  values: {
    studentIdNumber: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    suffix: string | null;
    address: string;
    gradeLevel: string;
    trackStrand: string | null;
    email: string | null;
    contactNumber: string | null;
    emergencyContactName: string;
    emergencyContactPhone: string;
    bloodType: string | null;
    consent: boolean;
  };
  errors: FieldErrors;
} {
  const errors: FieldErrors = {};

  const studentIdNumber = cleanText(input.studentIdNumber).slice(0, 64);
  if (!studentIdNumber) errors.studentIdNumber = "Student ID / LRN is required.";
  else if (!/^[A-Za-z0-9][A-Za-z0-9-]{2,63}$/.test(studentIdNumber))
    errors.studentIdNumber = "Enter a valid Student ID / LRN (letters, numbers, dashes).";

  const firstName = cleanText(input.firstName).slice(0, 100);
  if (!firstName) errors.firstName = "First name is required.";
  else if (!NAME_RE.test(firstName)) errors.firstName = "Enter a valid first name.";

  const middleNameRaw = cleanText(input.middleName).slice(0, 100);
  const middleName = middleNameRaw || null;
  if (middleName && !NAME_RE.test(middleName))
    errors.middleName = "Enter a valid middle name.";

  const lastName = cleanText(input.lastName).slice(0, 100);
  if (!lastName) errors.lastName = "Last name is required.";
  else if (!NAME_RE.test(lastName)) errors.lastName = "Enter a valid last name.";

  const suffixRaw = cleanText(input.suffix).slice(0, 20);
  const suffix = suffixRaw || null;
  if (suffix && !/^(Jr\.?|Sr\.?|I{1,3}|IV|V|VI{0,3})$/i.test(suffix))
    errors.suffix = "Enter a valid suffix (e.g. Jr., III).";

  const address = cleanMultiline(input.address).slice(0, 500);
  if (!address) errors.address = "Address is required.";
  else if (address.length < 8) errors.address = "Please enter a complete address.";

  const gradeLevel = cleanText(input.gradeLevel).slice(0, 40);
  if (!gradeLevel) errors.gradeLevel = "Grade level is required.";
  else if (!(GRADE_LEVELS as readonly string[]).includes(gradeLevel))
    errors.gradeLevel = "Select a valid grade level.";

  const trackRaw = cleanText(input.trackStrand).slice(0, 120);
  const isShs = gradeLevel === "Grade 11" || gradeLevel === "Grade 12";
  const trackStrand = isShs ? trackRaw || null : null;
  if (isShs && !trackStrand)
    errors.trackStrand = "Track / Strand is required for Senior High School.";
  else if (isShs && trackStrand && !(TRACK_STRANDS as readonly string[]).includes(trackStrand))
    errors.trackStrand = "Select a valid track / strand.";
  else if (!isShs && trackRaw)
    errors.trackStrand = "Track / Strand applies only to Grades 11–12. Clear this field and try again.";

  const emailRaw = cleanText(input.email).toLowerCase().slice(0, 255);
  const email = emailRaw || null;
  if (!email) errors.email = "Email address is required for application updates.";
  else if (!EMAIL_RE.test(email))
    errors.email = "Enter a valid email address.";

  const contactRaw = cleanText(input.contactNumber).slice(0, 32);
  const contactNumber = contactRaw || null;
  if (contactNumber && !PHONE_RE.test(contactNumber))
    errors.contactNumber = "Enter a valid phone number (e.g. 09xx xxx xxxx).";

  const emergencyContactName = cleanText(input.emergencyContactName).slice(0, 150);
  if (!emergencyContactName)
    errors.emergencyContactName = "Emergency contact person is required.";
  else if (!NAME_RE.test(emergencyContactName))
    errors.emergencyContactName = "Enter a valid contact person name.";

  const emergencyContactPhone = cleanText(input.emergencyContactPhone).slice(0, 32);
  if (!emergencyContactPhone)
    errors.emergencyContactPhone = "Emergency contact phone is required.";
  else if (!PHONE_RE.test(emergencyContactPhone))
    errors.emergencyContactPhone = "Enter a valid emergency phone number.";

  const bloodRaw = cleanText(input.bloodType).slice(0, 8);
  const bloodType = bloodRaw || null;
  if (bloodType && !(BLOOD_TYPES as readonly string[]).includes(bloodType))
    errors.bloodType = "Select a valid blood type.";

  const consent = input.consent === true || input.consent === "true" || input.consent === "on";
  if (!consent) errors.consent = "You must agree to the privacy notice to submit.";

  return {
    values: {
      studentIdNumber,
      firstName,
      middleName,
      lastName,
      suffix,
      address,
      gradeLevel,
      trackStrand,
      email,
      contactNumber,
      emergencyContactName,
      emergencyContactPhone,
      bloodType,
      consent,
    },
    errors,
  };
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
