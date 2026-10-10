import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/ui";
import { findPublicPage, publicPaths, publicPages } from "@/lib/public-pages";

const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const github = process.env.NEXT_PUBLIC_GITHUB_URL;
export const dynamicParams = false;
export function generateStaticParams() {
  return publicPaths.map((slug) => ({ slug }));
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = findPublicPage(slug.join("/"));
  if (!page) return {};
  const canonical = `/${page.slug}`;
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical },
    openGraph: { title: page.title, description: page.description, url: canonical, type: "article", images: [{ url: "/social-preview.png", width: 1200, height: 630, alt: "Shapre open-source AI streaming persona platform" }] },
    twitter: { card: "summary_large_image", title: page.title, description: page.description },
  };
}

export default async function PublicContentPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const page = findPublicPage(slug.join("/"));
  if (!page) notFound();
  const crumbs = page.slug.split("/");
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: origin },
      { "@type": "ListItem", position: 2, name: page.title, item: `${origin}/${page.slug}` },
    ],
  };
  return (
    <main className="public-page">
      <nav className="landing-nav"><Brand /><div className="row nav-links"><Link href="/">Home</Link><Link href="/features/open-source">Open source</Link><Link href="/docs/self-hosting">Self-hosting docs</Link></div><Link className="btn small primary" href="/signup">Try Shapre</Link></nav>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb).replace(/</g, "\\u003c") }} />
      <article className="public-article">
        <div className="eyebrow">{crumbs.slice(0, -1).join(" · ") || "Shapre guide"}</div>
        <h1>{page.title}</h1>
        <p className="public-intro">{page.intro}</p>
        {page.sections.map((section) => <section key={section.heading}><h2>{section.heading}</h2><p>{section.body.split(/(\[[^\]]+\]\([^)]+\))/g).map((part, i) => { const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/); return match ? <Link key={i} href={match[2]}>{match[1]}</Link> : part; })}</p></section>)}
        <section className="public-cta"><h2>Explore Shapre</h2><p>Try the Studio workflow or read how to run the project on your own infrastructure.</p><div className="hero-actions"><Link className="btn primary" href="/signup">Try Shapre</Link>{github ? <a className="btn" href={github}>View GitHub</a> : <Link className="btn" href="/features/open-source">Open-source overview</Link>}</div></section>
        <nav className="public-related" aria-label="Related pages"><Link href="/open-source-ai-avatar">Open-source AI avatar</Link><Link href="/ai-face-swap-for-obs">Face transformation for OBS</Link><Link href="/ai-voice-changer-for-streaming">Voice conversion for streaming</Link><Link href="/docs/inference">Inference setup</Link></nav>
      </article>
      <footer className="footer public-footer">
        <Link href="/">Shapre</Link>
        <div><strong>Features</strong>{publicPages.filter((item) => item.slug.startsWith("features/")).map((item) => <Link key={item.slug} href={`/${item.slug}`}>{item.title}</Link>)}</div>
        <div><strong>Use cases</strong>{publicPages.filter((item) => item.slug.startsWith("use-cases/")).map((item) => <Link key={item.slug} href={`/${item.slug}`}>{item.title}</Link>)}</div>
        <div><strong>Guides</strong>{publicPages.filter((item) => item.slug.startsWith("docs/")).map((item) => <Link key={item.slug} href={`/${item.slug}`}>{item.title}</Link>)}</div>
        <div><strong>Topics</strong>{publicPages.filter((item) => !item.slug.includes("/") || item.slug.startsWith("compare/")).map((item) => <Link key={item.slug} href={`/${item.slug}`}>{item.title}</Link>)}</div>
        <Link href="/legal/privacy">Privacy</Link>
      </footer>
    </main>
  );
}
