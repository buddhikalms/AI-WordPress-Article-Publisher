import type { Metadata } from "next";
import { Bot, CreditCard, FileText, Globe2, Mail, Newspaper, SearchCheck, Sparkles } from "lucide-react";
import PublicPage from "@/components/public/PublicPage";
import PageHero from "@/components/public/PageHero";
import IntegrationCard from "@/components/public/IntegrationCard";

export const metadata: Metadata = { title: "Integrations | AI Article Publisher", description: "Connect WordPress, OpenAI, Google Docs, NewsData, AIOSEO, Yoast, Stripe, and SMTP." };
const integrations = [
  [Globe2, "WordPress", "Publishing", "Create taxonomy, media, drafts, scheduled posts, and published articles through the REST API."],
  [Sparkles, "OpenAI", "AI", "Generate structured articles and original featured or in-post images."],
  [FileText, "Google Docs", "Editorial", "Import public documents, front matter, formatting, and embedded media."],
  [Newspaper, "NewsData", "Research", "Find fresh category and keyword-based source stories for rewriting workflows."],
  [SearchCheck, "AIOSEO", "SEO", "Apply titles, descriptions, keywords, canonical URLs, and social metadata."],
  [Bot, "Yoast", "SEO", "Send compatible search fields through supported WordPress metadata paths."],
  [CreditCard, "Stripe-ready billing", "Commerce", "Sell token packages with checkout, confirmation, and signed webhook handling."],
  [Mail, "SMTP", "Messaging", "Deliver credentials-account verification and operational email."],
] as const;
export default function IntegrationsPage() { return <PublicPage><PageHero eyebrow="Integrations" title="Connect the services behind modern content operations" description="A focused ecosystem for generation, editorial input, billing, email, SEO, and WordPress delivery." /><section className="py-20"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{integrations.map(([icon, name, category, description]) => <IntegrationCard key={name} icon={icon} name={name} category={category} description={description} />)}</div></div></section></PublicPage>; }
