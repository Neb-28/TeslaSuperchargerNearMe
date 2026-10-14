// Contact page form: the fields' limits and validation. Shared by the form (browser) and the
// server action, so it must not import anything server-only.
export const MESSAGE_MAX = 500;
const NAME_MAX = 60;
const PHONE_MAX = 20;

// Dialing codes offered next to the phone field; US drivers are most of our visitors.
export const DIAL_CODES = [
  { code: "+1", label: "United States / Canada" },
  { code: "+44", label: "United Kingdom" },
  { code: "+61", label: "Australia" },
  { code: "+49", label: "Germany" },
  { code: "+33", label: "France" },
  { code: "+31", label: "Netherlands" },
  { code: "+47", label: "Norway" },
  { code: "+46", label: "Sweden" },
  { code: "+41", label: "Switzerland" },
  { code: "+34", label: "Spain" },
  { code: "+39", label: "Italy" },
  { code: "+52", label: "Mexico" },
  { code: "+64", label: "New Zealand" },
  { code: "+81", label: "Japan" },
  { code: "+86", label: "China" },
] as const;

export type ContactMessage = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  message: string;
  createdAt: string;
};

export type NewContactMessage = Omit<ContactMessage, "id" | "createdAt">;
export type ContactFormErrors = Partial<Record<"firstName" | "lastName" | "email" | "phone" | "message", string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContactForm(form: FormData): { ok: true; values: NewContactMessage } | { ok: false; errors: ContactFormErrors } {
  const text = (name: string) => String(form.get(name) ?? "").trim();
  const firstName = text("firstName");
  const lastName = text("lastName");
  const email = text("email");
  const phoneNumber = text("phone");
  const dialCode = DIAL_CODES.some((item) => item.code === text("dialCode")) ? text("dialCode") : "+1";
  const message = text("message");
  const errors: ContactFormErrors = {};

  if (!firstName) errors.firstName = "Enter your first name.";
  else if (firstName.length > NAME_MAX) errors.firstName = `Keep it under ${NAME_MAX} characters.`;
  if (lastName.length > NAME_MAX) errors.lastName = `Keep it under ${NAME_MAX} characters.`;
  if (!EMAIL.test(email)) errors.email = "Enter an email address we can reply to.";
  if (phoneNumber && (!/^[\d\s().-]+$/.test(phoneNumber) || phoneNumber.length > PHONE_MAX)) errors.phone = "Enter a phone number using digits only.";
  if (!message) errors.message = "Tell us how we can help.";
  else if (message.length > MESSAGE_MAX) errors.message = `Keep it under ${MESSAGE_MAX} characters.`;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    values: { firstName, lastName: lastName || null, email, phone: phoneNumber ? `${dialCode} ${phoneNumber}` : null, message },
  };
}
