import { Hero } from '../components/marketing/Hero';
import { WorkflowStory } from '../components/marketing/WorkflowStory';
import { TemplateShowcase } from '../components/marketing/TemplateShowcase';
import { EditorSplit } from '../components/marketing/EditorSplit';
import { RecruiterSection } from '../components/marketing/RecruiterSection';
import { CareerTools } from '../components/marketing/CareerTools';
import { FinalCTA } from '../components/marketing/FinalCTA';

/**
 * Marketing landing — storytelling sequence:
 * Hero → workflow → templates → editor → recruiters → ATS/tailoring → CTA.
 * All portfolio previews render through the real template engine.
 */
export default function Home() {
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
