import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title: {
    default: "Shapre — Open Source AI Avatar & Voice Changer for Live Streaming",
    template: "%s · Shapre",
  },
  description:
    "Shapre is an open-source real-time AI streaming platform for webcam personas, face transformation, voice changing, OBS workflows, and self-hosting.",
  openGraph: {
    type: "website",
    siteName: "Shapre",
    title: "Shapre — Open Source AI Avatar for Live Streaming",
    description:
      "Turn a webcam and microphone into a live AI persona. Explore Shapre, its OBS workflow, and self-hosting options.",
    images: [{ url: "/social-preview.png", width: 1200, height: 630, alt: "Shapre open-source AI streaming persona platform" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Shapre — Open Source AI Avatar for Live Streaming",
    description: "A self-hostable platform for live webcam personas, voice transformation, and OBS workflows.",
    images: ["/social-preview.png"],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "64x64" },
      { url: "/icon.png", type: "image/png", sizes: "64x64" },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster theme="dark" richColors position="bottom-right" />
      </body>
    </html>
  );
}
