export function friendlyDeliveryError(error: string | null | undefined): string {
  if (!error) return "";
  const message = error.trim();
  if (/ENOTFOUND|getaddrinfo|EAI_AGAIN/i.test(message)) {
    return "The email server address could not be found. Check the SMTP host name in the email configuration.";
  }
  if (/ECONNREFUSED|connection refused/i.test(message)) {
    return "The email server refused the connection. Check the SMTP host and port, and confirm the server is available.";
  }
  if (/ETIMEDOUT|ESOCKETTIMEDOUT|timeout/i.test(message)) {
    return "The email server did not respond in time. Check the connection and try sending again.";
  }
  if (/EAUTH|authentication|invalid login|535/i.test(message)) {
    return "The email server rejected the configured sign-in details. Check the SMTP username and password.";
  }
  if (/certificate|TLS|SSL|secure connection/i.test(message)) {
    return "A secure connection to the email server could not be established. Check the SMTP security settings.";
  }
  if (/^SMTP delivery failed:/i.test(message)) {
    return "The email could not be delivered. Check the email server settings and try again.";
  }
  return message;
}

export function deliveryErrorFromException(error: unknown): string {
  const err = error instanceof Error ? error as Error & { code?: string; cause?: { code?: string } } : null;
  const code = err?.code ?? err?.cause?.code;
  const message = err?.message ?? "";
  if (code) return friendlyDeliveryError(`${code}: ${message}`);
  return friendlyDeliveryError(message || "SMTP delivery failed.");
}
