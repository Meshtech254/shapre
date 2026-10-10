import type { MetadataRoute } from "next";
import { publicPages } from "@/lib/public-pages";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const now = new Date();
  return [
    { url: origin, lastModified: now, changeFrequency: "weekly", priority: 1 },
    ...publicPages.map((page) => ({ url: `${origin}/${page.slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: page.slug.startsWith("docs/") ? 0.7 : 0.8 })),
    ...["terms", "privacy", "acceptable-use"].map((slug) => ({ url: `${origin}/legal/${slug}`, lastModified: now, changeFrequency: "yearly" as const, priority: 0.3 })),
  ];
}
