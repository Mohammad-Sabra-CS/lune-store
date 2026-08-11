import { PACKAGE_PRICE } from "@/lib/constants";
import type { MoonPhase } from "@/components/brand/moon-phase";

export type Audience = "men" | "women";

export interface Product {
  slug: string;
  name: string;
  audience: Audience;
  price: number;
  /** Main card/hero image */
  image: string;
  /** Detail page gallery, primary first */
  gallery: string[];
  /** Chapter phase — the four packages as four phases of one moon */
  phase: MoonPhase;
  /** One charming line, written (not translated) for each language */
  poetry: { en: string; ar: string };
  character: { en: string; ar: string };
  description: { en: string; ar: string };
  /** Accent used for subtle per-package theming */
  accent: "navy" | "wine" | "red";
}

export const products: Product[] = [
  {
    slug: "apollo",
    name: "Apollo",
    audience: "men",
    price: PACKAGE_PRICE,
    image: "/products/apollo-box.jpg",
    gallery: ["/products/apollo-box.jpg", "/products/set-men.jpg", "/products/bottle-men.jpg"],
    phase: "crescent",
    poetry: {
      en: "For evenings that expect a presence.",
      ar: "لأمسياتٍ تنتظر حضورًا.",
    },
    character: {
      en: "Heavy · Formal · Winter",
      ar: "ثقيل · رسمي · شتوي",
    },
    description: {
      en: "A heavy, formal composition made for winter evenings. High luxury with a commanding presence — for occasions where you intend to be remembered.",
      ar: "لمحبّي العطر الثقيل الرسمي: شتويّ بامتياز، وفخامة عالية. مناسبة مهمة؟ حضورك سيطغى… والحل معروف.",
    },
    accent: "navy",
  },
  {
    slug: "orion",
    name: "Orion",
    audience: "men",
    price: PACKAGE_PRICE,
    image: "/products/orion-box.jpg",
    gallery: ["/products/orion-box.jpg", "/products/set-men.jpg", "/products/bottle-men.jpg"],
    phase: "half",
    poetry: {
      en: "Calm seas, worn close to the skin.",
      ar: "هدوء البحر، قريبًا من القلب.",
    },
    character: {
      en: "Fresh · Marine · Citrus",
      ar: "منعش · بحري · حمضي",
    },
    description: {
      en: "A refreshing marine opening with a touch of elegant citrus. For the calm man — a balanced, composed presence that never tries too hard.",
      ar: "بداية بحرية منعشة مع لمسة حمضيات أنيقة. لرجلٍ هادئ يترك أينما حلّ حضورًا متوازنًا ومرتّبًا.",
    },
    accent: "navy",
  },
  {
    slug: "elysia",
    name: "Elysia",
    audience: "women",
    price: PACKAGE_PRICE,
    image: "/products/elysia-box.jpg",
    gallery: ["/products/elysia-box.jpg", "/products/set-women.jpg", "/products/bottle-women.jpg"],
    phase: "gibbous",
    poetry: {
      en: "A garden that blooms only after dark.",
      ar: "حديقة لا تتفتّح إلا بعد الغروب.",
    },
    character: {
      en: "Soft · Rose · Jasmine",
      ar: "ناعم · ورد · ياسمين",
    },
    description: {
      en: "Femininity at its softest. A heart of rose wrapped in jasmine — the result is refined, gentle and unmistakably graceful.",
      ar: "أنوثة ونعومة حتى آخر لحظة. حين يكون قلب العطر وردًا وياسمينًا، فالنتيجة حتمًا راقية وناعمة.",
    },
    accent: "wine",
  },
  {
    slug: "aurora",
    name: "Aurora",
    audience: "women",
    price: PACKAGE_PRICE,
    image: "/products/aurora-box.jpg",
    gallery: ["/products/aurora-box.jpg", "/products/set-women.jpg", "/products/hero-marble.jpg"],
    phase: "full",
    poetry: {
      en: "She arrives, and the room remembers.",
      ar: "تدخلين، فيتذكّرك المكان.",
    },
    character: {
      en: "Bold · Confident · Radiant",
      ar: "جريء · واثق · لافت",
    },
    description: {
      en: "The bold one. Confidence and presence that turn heads from the first moment. A fragrance that speaks for you.",
      ar: "العطر الجريء: ثقة وحضور يلفت الأنظار من أول لحظة. تبحثين عن عطر يتحدث عنك؟",
    },
    accent: "red",
  },
];

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}
