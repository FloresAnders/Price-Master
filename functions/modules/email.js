const MAX_RECIPIENT_LENGTH = 320;
const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 20_000;
const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export function normalizeEmailJob(input) {
  const to = typeof input?.to === "string" ? input.to.trim() : "";
  const subject =
    typeof input?.subject === "string" ? input.subject.trim() : "";
  const text = typeof input?.text === "string" ? input.text : "";
  const html = typeof input?.html === "string" ? input.html : undefined;

  if (!to || to.length > MAX_RECIPIENT_LENGTH || !EMAIL_PATTERN.test(to)) {
    throw new Error("Invalid email recipient");
  }
  if (!subject || subject.length > MAX_SUBJECT_LENGTH) {
    throw new Error("Invalid email subject");
  }
  if (!text || text.length > MAX_BODY_LENGTH) {
    throw new Error("Invalid email body");
  }
  if (html !== undefined && html.length > MAX_BODY_LENGTH) {
    throw new Error("Invalid email body");
  }
  if (Array.isArray(input?.attachments) && input.attachments.length > 0) {
    throw new Error("Email attachments are not allowed");
  }

  return {
    to,
    subject,
    text,
    ...(html === undefined ? {} : { html }),
  };
}
