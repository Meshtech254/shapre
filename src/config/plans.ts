export const plans = {
  free: {
    name: "Free",
    personas: 1,
    minutes: 30,
    watermark: true,
    highQuality: false,
    features: ["1 persona", "30 streaming minutes / month", "Shapre watermark"],
  },
  creator: {
    name: "Creator",
    personas: 5,
    minutes: 600,
    watermark: false,
    highQuality: false,
    features: [
      "5 personas",
      "600 streaming minutes / month",
      "Face + voice transformation",
      "No watermark",
    ],
  },
  pro: {
    name: "Pro",
    personas: 20,
    minutes: 2400,
    watermark: false,
    highQuality: true,
    features: [
      "20 personas",
      "2,400 streaming minutes / month",
      "High-quality mode",
      "Priority GPU capacity",
      "Advanced streaming features",
    ],
  },
} as const;
export type Plan = keyof typeof plans;
