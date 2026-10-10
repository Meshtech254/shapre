import Link from "next/link";
import {
  ArrowUpRight,
  Fingerprint,
  AudioLines,
  Radio,
  Monitor,
  ShieldCheck,
  ScanFace,
  SlidersHorizontal,
} from "lucide-react";
import { Brand } from "@/components/ui";
import type { Metadata } from "next";
export const metadata: Metadata = { alternates: { canonical: "/" } };
const faqs: [string, string][] = [
  ["Is Shapre open source?", "The project is prepared for release under AGPL-3.0. Review the license and repository release checklist before publishing."],
  ["Can I use Shapre with OBS?", "Yes. A real local or remote inference worker can provide a session output for OBS Browser Source. Mock mode works only between tabs in one browser context."],
  ["Can I use Iriun Webcam?", "Shapre uses browser MediaDevices, so Iriun and similar tools can work when their camera is recognized by the operating system and browser."],
  ["Can Shapre change my voice in real time?", "Voice transformation requires a compatible external inference worker and model. The web app does not bundle voice models."],
  ["Can I upload my own avatar?", "You can configure persona images you own or have permission to process. Face transformation requires a compatible inference worker."],
  ["Can I run Shapre locally?", "The web app can run locally with mock, local, or remote inference. Supabase is used for authentication, database, and private storage."],
  ["Do I need an NVIDIA GPU?", "Mock mode needs no GPU. Real inference requirements depend on the selected model and worker; check upstream hardware guidance."],
  ["Is Shapre a VTuber tool?", "Shapre supports webcam-driven virtual persona workflows. Traditional VTuber software often animates authored 2D or 3D characters."],
  ["Can I stream without showing my real face?", "You can configure persona assets you own or have permission to use. A persona does not by itself make a stream anonymous."],
];
export default function Home() {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const repositoryUrl = process.env.NEXT_PUBLIC_GITHUB_URL;
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Shapre",
      url: siteUrl,
      ...(repositoryUrl ? { sameAs: [repositoryUrl] } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": ["SoftwareApplication", "WebApplication"],
      name: "Shapre",
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      softwareVersion: "0.1.0",
      description: "An open-source real-time AI streaming persona platform for webcam personas, voice transformation, OBS workflows, and self-hosting.",
      url: siteUrl,
      license: "https://www.gnu.org/licenses/agpl-3.0.html",
      ...(repositoryUrl ? { codeRepository: repositoryUrl } : {}),
    },
  ];
  return (
    <div className="landing">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <nav className="landing-nav">
        <Brand />
        <div className="row nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#built-for-creators">For creators</a>
        </div>
        <div className="row">
          <Link href="/login">Log in</Link>
          <Link className="btn small primary" href="/signup">
            Get started <ArrowUpRight size={14} />
          </Link>
        </div>
      </nav>
      <section className="hero">
        <span className="badge" style={{ color: "var(--accent)" }}>
          ● &nbsp; A new way to show up
        </span>
        <h1>
          Open Source AI Avatars
          <br />
          <em>for Live Streaming</em>
        </h1>
        <p>
          Turn your webcam and microphone into a live AI persona with real-time
          face transformation, voice changing, and OBS support. Run Shapre
          yourself and choose the inference service that fits your setup.
        </p>
        <div className="hero-actions">
          <Link href="/signup" className="btn primary">
            Create your persona <ArrowUpRight size={17} />
          </Link>
          <a href="#how-it-works" className="btn">
            See how it works
          </a>
        </div>
        <p style={{ fontSize: 11, marginTop: 18 }}>
          Built for identities you own or have permission to use.
        </p>
        <div className="hero-studio">
          <div className="demo-top">
            <span className="row">
              <Radio size={15} color="var(--accent)" /> Shapre Studio
            </span>
            <span className="badge">Studio concept preview</span>
          </div>
          <div className="demo-body">
            <div className="stack">
              <div className="eyebrow">Your persona</div>
              <div className="persona-art" style={{ minHeight: 180 }}>
                <Fingerprint size={72} />
              </div>
              <div>
                <h3>A presence of your own</h3>
                <p style={{ fontSize: 12 }}>Face + voice identity</p>
              </div>
              <span className="badge">Designed for live</span>
            </div>
            <div className="demo-preview">
              <div className="demo-orbit">
                <ScanFace size={95} strokeWidth={0.75} />
              </div>
              <span className="demo-caption">YOUR NEXT CREATIVE CHAPTER</span>
            </div>
            <div className="stack">
              <div className="row">
                <SlidersHorizontal size={15} />
                <span>Live controls</span>
              </div>
              {["Face identity", "Expression strength", "Voice similarity"].map(
                (text, i) => (
                  <div key={text}>
                    <p style={{ fontSize: 11, marginBottom: 8 }}>{text}</p>
                    <div className="progress">
                      <div style={{ width: `${70 - i * 10}%` }} />
                    </div>
                  </div>
                ),
              )}
              <div className="notice">
                A dedicated space for your creative identity.
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="landing-section">
        <div className="eyebrow">Open source and self-hostable</div>
        <h2 style={{ marginTop: 12 }}>Run Shapre on infrastructure you control.</h2>
        <p style={{ marginTop: 12, maxWidth: 720 }}>
          Explore the code, run the web app locally, connect a local or remote
          inference worker, and contribute. Mock mode lets you explore the
          interface without model weights or GPU hardware.
        </p>
        <div className="hero-actions">
          <Link href="/docs/self-hosting" className="btn primary">Self-hosting guide</Link>
          <Link href="/features/open-source" className="btn">Open-source details</Link>
          {process.env.NEXT_PUBLIC_GITHUB_URL && <a href={process.env.NEXT_PUBLIC_GITHUB_URL} className="btn">View GitHub</a>}
        </div>
      </section>
      <section className="landing-section">
        <div className="eyebrow">Learn more</div>
        <h2 style={{ marginTop: 12 }}>Guides for your streaming setup</h2>
        <div className="grid3" style={{ marginTop: 22 }}>
          <Link className="card" href="/ai-face-swap-for-obs"><h3>AI face workflows for OBS</h3><p>Understand the worker and Browser Source requirements.</p></Link>
          <Link className="card" href="/ai-voice-changer-for-streaming"><h3>Voice conversion for streaming</h3><p>Learn about models, permissions, and live audio.</p></Link>
          <Link className="card" href="/open-source-vtuber-alternative"><h3>VTuber workflows</h3><p>Compare camera-driven personas and traditional avatar tools.</p></Link>
        </div>
      </section>
      <section className="landing-section">
        <div className="eyebrow">Common questions</div>
        <h2 style={{ marginTop: 12 }}>Shapre FAQ</h2>
        <div className="faq-list">
          {faqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
        </div>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(([name, answer]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text: answer } })) }).replace(/</g, "\\u003c") }} />
      </section>
      <section id="how-it-works" className="landing-section">
        <div className="eyebrow">From identity to on air</div>
        <h2 style={{ marginTop: 12 }}>Your next persona, in three steps.</h2>
        <div className="grid3">
          {[
            [
              "01",
              "Make it yours",
              "Upload clear face images and an optional voice sample. Confirm your rights before creating.",
            ],
            [
              "02",
              "Find your presence",
              "Prepare your identity, choose your devices, and fine-tune your studio settings.",
            ],
            [
              "03",
              "Take the stage",
              "Preview in your studio and bring the output into OBS with a Browser Source.",
            ],
          ].map(([n, t, d]) => (
            <div className="card stack" key={n}>
              <span className="eyebrow">{n}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>
      <section id="built-for-creators" className="landing-section">
        <div className="eyebrow">Built for your broadcast</div>
        <h2 style={{ marginTop: 12 }}>A creator tool. Through and through.</h2>
        <div className="grid3">
          {[
            [
              ScanFace,
              "Realistic AI face",
              "Create a digital identity that follows your expressions through an external inference service.",
            ],
            [
              AudioLines,
              "Live voice transformation",
              "Give your persona a voice from recordings you own or have permission to use.",
            ],
            [
              Radio,
              "Your streaming studio",
              "Large previews, device controls, and the settings you need to find your flow.",
            ],
            [
              Monitor,
              "Made for OBS",
              "A dedicated output page connects your session to an OBS Browser Source.",
            ],
            [
              ShieldCheck,
              "Privacy by design",
              "Private uploads and controlled access keep your sensitive face and voice assets protected.",
            ],
            [
              Fingerprint,
              "Creative freedom",
              "Build an original avatar, separate your on-camera presence, or explore a new creative identity.",
            ],
          ].map(([Icon, t, d]) => {
            const I = Icon as typeof ScanFace;
            return (
              <div className="card" key={String(t)}>
                <I className="feature-icon" size={25} />
                <h3>{String(t)}</h3>
                <p style={{ marginTop: 10 }}>{String(d)}</p>
              </div>
            );
          })}
        </div>
      </section>
      <section className="landing-section" style={{ textAlign: "center" }}>
        <h2>Make your next appearance yours.</h2>
        <p style={{ margin: "15px 0 25px" }}>
          Start with a persona. Build a whole new creative chapter.
        </p>
        <Link href="/signup" className="btn primary">
          Create your persona <ArrowUpRight size={16} />
        </Link>
      </section>
      <footer className="footer">
        <span style={{ marginRight: "auto" }}>
          © {new Date().getFullYear()} Shapre
        </span>
        <Link href="/legal/terms">Terms</Link>
        <Link href="/legal/privacy">Privacy</Link>
        <Link href="/legal/acceptable-use">Acceptable use</Link>
        <a
          href={`mailto:${process.env.NEXT_PUBLIC_ABUSE_EMAIL ?? "abuse@example.com"}`}
        >
          Report abuse
        </a>
      </footer>
    </div>
  );
}
