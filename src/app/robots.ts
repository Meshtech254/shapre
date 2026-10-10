import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/studio", "/personas", "/demo-personas", "/dashboard", "/settings", "/billing", "/login", "/signup", "/api/"] },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
