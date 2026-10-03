import nodemailer from "nodemailer";
import { config } from "@/lib/config";

const PLACEHOLDER_VALUES = ["example.edu", "REPLACE_ME"];

export function mailConfigurationError(): string | null {
  const { host, port, username, password, encryption, fromAddress } = config.mail;
  if (!host || !fromAddress) {
    return "SMTP is not configured. Set MAIL_HOST and MAIL_FROM_ADDRESS in .env.";
  }
  if (
    PLACEHOLDER_VALUES.some((placeholder) =>
      [host, username, password, fromAddress].some((value) =>
        value.toLowerCase().includes(placeholder.toLowerCase()),
      ),
    )
  ) {
    return "SMTP settings still contain example values. Replace the MAIL_* placeholders in .env.";
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return "MAIL_PORT must be a valid port number between 1 and 65535.";
  }
  if (!["tls", "ssl"].includes(encryption)) {
    return "MAIL_ENCRYPTION must be tls (STARTTLS) or ssl (implicit TLS).";
  }
  if (Boolean(username) !== Boolean(password)) {
    return "Set both MAIL_USERNAME and MAIL_PASSWORD for authenticated SMTP, or leave both empty.";
  }
  return null;
}

export function createMailerTransport() {
  return nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.encryption === "ssl",
    auth: config.mail.username
      ? { user: config.mail.username, pass: config.mail.password }
      : undefined,
    requireTLS: config.mail.encryption === "tls",
    connectionTimeout: 10_000,
    socketTimeout: 15_000,
  });
}
