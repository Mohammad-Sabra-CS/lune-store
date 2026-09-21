/** Descriptions transcribed/translated from the owner's Apollo and Orion
 * reference cards supplied 2026-09-21. Update only untouched legacy copy. */
const approved = {
  apollo: {
    character: {
      en: ["Heavy · Formal · Winter", "Warm · Sweet · Spicy"],
      ar: ["ثقيل · رسمي · شتوي", "دافئ · حلو · شرقي"],
    },
    description: {
      en: [
        "A heavy, formal composition made for winter evenings. High luxury with a commanding presence — for occasions where you intend to be remembered.",
        "Warm and sweet, with an inviting spicy character. A warm, lightly fresh opening gives way to a soft aromatic heart and a rich base of vanilla and chestnut. An elegant companion for evenings and cooler weather.",
      ],
      ar: [
        "لمحبّي العطر الثقيل الرسمي: شتويّ بامتياز، وفخامة عالية. مناسبة مهمة؟ حضورك سيطغى… والحل معروف.",
        "عطر دافئ وحلو بطابع شرقي جذاب. يبدأ بنفحات حارة ومنعشة قليلًا، ثم ينتقل إلى قلب عطري ناعم، قبل أن يستقر على قاعدة غنية من الفانيلا والكستناء. أنيق ومناسب للمساء والأجواء الباردة.",
      ],
    },
  },
  orion: {
    description: {
      en: [
        "A refreshing marine opening with a touch of elegant citrus. For the calm man — a balanced, composed presence that never tries too hard.",
        "Fresh, clean and sporty. Bright citrus meets a clear marine character and a soft woody touch. A lively opening reveals an elegant, clean heart, settling into a gentle warmth of tonka, musk, amber and vetiver.",
      ],
      ar: [
        "بداية بحرية منعشة مع لمسة حمضيات أنيقة. لرجلٍ هادئ يترك أينما حلّ حضورًا متوازنًا ومرتّبًا.",
        "عطر منعش ونظيف ورياضي، يجمع بين الحمضيات اللامعة والطابع البحري النقي ولمسة خشبية ناعمة. بداية مشرقة ومفعمة بالطاقة، ثم قلب نظيف وأنيق، وفي النهاية أثر دافئ خفيف من التونكا والمسك والعنبر والفيتيفر.",
      ],
    },
  },
} satisfies Record<
  string,
  Partial<
    Record<"character" | "description", Record<"en" | "ar", [string, string]>>
  >
>;

export function resolveApprovedCopy(
  slug: string,
  field: "character" | "description",
  current: Record<"en" | "ar", string>,
): Record<"en" | "ar", string> {
  const entry = (
    approved as Record<
      string,
      Partial<
        Record<
          "character" | "description",
          Record<"en" | "ar", [string, string]>
        >
      >
    >
  )[slug]?.[field];
  if (!entry) return current;
  return {
    en: current.en === entry.en[0] ? entry.en[1] : current.en,
    ar: current.ar === entry.ar[0] ? entry.ar[1] : current.ar,
  };
}
