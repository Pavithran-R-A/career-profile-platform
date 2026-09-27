import { Hero } from '../components/marketing/Hero';
import { WorkflowStory } from '../components/marketing/WorkflowStory';
import { TemplateShowcase } from '../components/marketing/TemplateShowcase';
import { EditorSplit } from '../components/marketing/EditorSplit';
import { RecruiterSection } from '../components/marketing/RecruiterSection';
import { CareerTools } from '../components/marketing/CareerTools';
import { FinalCTA } from '../components/marketing/FinalCTA';
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, OG_IMAGE_PATH } from '../lib/seo/meta';
import { usePageMeta } from '../lib/seo/usePageMeta';

/**
 * Marketing landing — storytelling sequence:
 * Hero → workflow → templates → editor → recruiters → ATS/tailoring → CTA.
 * All portfolio previews render through the real template engine.
 */
export default function Home() {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  usePageMeta({
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    canonical: `${origin}/`,
    ogType: 'website',
    ogImage: `${origin}${OG_IMAGE_PATH}`,
  });

  return (
    <div>
      <Hero />
      <WorkflowStory />
      <TemplateShowcase />
      <EditorSplit />
      <RecruiterSection />
      <CareerTools />
      <FinalCTA />
    </div>
  );
}
