const CATEGORY_ICONS: Record<string, string> = {
  "doctor-appointment": "🩺",
  "government-office": "🏛️",
  restaurant: "🍽️",
  salon: "💇",
  "general-practitioners": "🩺",
  cardiologists: "❤️",
  pediatricians: "👶",
  dermatologists: "✨",
  neurologists: "🧠",
  endocrinologists: "🩸",
  gastroenterologists: "🧬",
  psychiatrists: "🧘",
  orthopedics: "🦴",
  dentists: "🦷",
  ophthalmologists: "👁️",
  gynecologists: "🌸",
};

export function getCategoryIcon(category: { slug: string; icon?: string | null }) {
  return CATEGORY_ICONS[category.slug] || (category.icon && !/^\?+$/.test(category.icon) ? category.icon : "📍");
}
