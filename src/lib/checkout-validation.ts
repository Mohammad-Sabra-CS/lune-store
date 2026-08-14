/**
 * Shared checkout field rules — the single source for both the client-side
 * validator (checkout-form) and the server action's zod schema. Plain
 * constants only, so nothing heavy lands in the client bundle.
 */

export const NAME_MIN = 2;
export const NAME_MAX = 120;
export const EMAIL_MAX = 200;
export const CITY_MIN = 2;
export const CITY_MAX = 80;
export const ADDRESS_MIN = 4;
export const ADDRESS_MAX = 300;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^\+?[0-9\s-]{8,15}$/;
