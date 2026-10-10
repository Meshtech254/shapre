import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/ui";
import type { Metadata } from "next";
const documents: Record<
  string,
  { title: string; sections: [string, string][] }
> = {
  terms: {
    title: "Terms of use",
    sections: [
      [
        "Using Shapre",
        "Shapre provides persona creation and streaming tools. You are responsible for your account, your uploads, and how you use your output. Use only face images and voice recordings you own or have permission to use.",
      ],
      [
        "Your content",
        "You retain rights to your content. You authorize Shapre and its configured processing providers to store and process it only to provide the persona and streaming features you request.",
      ],
      [
        "Service availability",
        "Features depend on browser support and external inference services. Development mock mode does not perform AI transformation. Billing is not enabled in this MVP.",
      ],
      [
        "Responsible use",
        "You must follow our Acceptable Use Policy. We may restrict access to content or sessions that violate the policy. Do not use this service for deception or to infringe another person’s rights.",
      ],
      [
        "Deletion and contact",
        "You can remove your personas and their assets in the application. Contact the operator using the Report Abuse link for account or policy concerns.",
      ],
    ],
  },
  privacy: {
    title: "Privacy policy",
    sections: [
      [
        "What we store",
        "We store account details, uploaded face images and voice samples, rights confirmation timestamps, persona preparation statuses, studio settings, session records, and streaming usage. We do not identify unrelated people using biometrics.",
      ],
      [
        "Private assets",
        "Uploads live in private storage buckets. Short-lived signed URLs give authorized users and configured inference processors access to the files required for their requests.",
      ],
      [
        "Camera and microphone",
        "Browser preview stays local until you explicitly start a session. Starting a real session sends your media to the configured external inference service. Development mock sessions use a local browser connection and do not perform transformation.",
      ],
      [
        "Providers and retention",
        "Authentication, database, and storage use Supabase. Hosting uses your deployment provider. Real inference uses a separately configured service. Persona deletion removes assets from active storage; backups follow the operator’s infrastructure retention settings.",
      ],
      [
        "Stream links",
        "OBS output links are temporary bearer credentials: anyone with the link can view an active output. Keep links private. They expire after eight hours, and session stopping disables access.",
      ],
      [
        "Your choices",
        "You can delete personas and change your account display name and streaming defaults. Contact the operator to request account removal or ask about data handling.",
      ],
    ],
  },
  "acceptable-use": {
    title: "Acceptable Use Policy",
    sections: [
      [
        "Create with permission",
        "Upload only images and recordings you own or have explicit permission to use. A rights confirmation is required before uploads. You are responsible for keeping evidence of permission.",
      ],
      [
        "No deceptive impersonation",
        "Do not impersonate another person to mislead viewers, commit fraud, manipulate public opinion, or falsely suggest endorsement. Do not create nonconsensual intimate content or exploitative content involving minors.",
      ],
      [
        "Respect people and platforms",
        "Do not use Shapre for harassment, threats, illegal activity, rights violations, or attempts to bypass security and moderation. Follow the rules of your streaming platform and disclose synthetic media when appropriate.",
      ],
      [
        "Moderation",
        "The architecture supports restricting personas before processing. Operators may review reports and block preparation or streaming of abusive content. This MVP does not perform automated biometric identification.",
      ],
      [
        "Report abuse",
        "Use the Report Abuse link to contact the operator. Include the relevant persona or stream link and a concise description. Avoid sending unnecessary sensitive media.",
      ],
    ],
  },
};
export async function generateMetadata({ params }: { params: Promise<{ document: string }> }): Promise<Metadata> {
  const { document } = await params;
  const doc = documents[document];
  if (!doc) return {};
  return {
    title: doc.title,
    description: `${doc.title} for Shapre, an open-source AI streaming persona platform.`,
    alternates: { canonical: `/legal/${document}` },
  };
}
export default async function Legal({
  params,
}: {
  params: Promise<{ document: string }>;
}) {
  const { document } = await params;
  const doc = documents[document];
  if (!doc) notFound();
  return (
    <article className="legal">
      <Brand />
      <div className="eyebrow" style={{ marginTop: 45 }}>
        Responsible creativity
      </div>
      <h1 style={{ marginTop: 15 }}>{doc.title}</h1>
      <p>Updated October 7, 2026</p>
      {doc.sections.map(([title, text]) => (
        <section key={title}>
          <h2>{title}</h2>
          <p>{text}</p>
        </section>
      ))}
      <div className="footer">
        <Link href="/legal/terms">Terms</Link>
        <Link href="/legal/privacy">Privacy</Link>
        <Link href="/legal/acceptable-use">Acceptable use</Link>
        <a
          href={`mailto:${process.env.NEXT_PUBLIC_ABUSE_EMAIL ?? "abuse@example.com"}`}
        >
          Report abuse
        </a>
      </div>
    </article>
  );
}
