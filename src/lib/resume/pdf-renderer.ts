import type { ATSResumeViewModel } from './ats-view-model';

export interface PDFRenderOptions {
  pageSize?: 'letter' | 'a4';
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  fontSize?: {
    name: number;
    heading: number;
    body: number;
    small: number;
  };
  fontFamily?: string;
}

export const DEFAULT_PDF_OPTIONS: PDFRenderOptions = {
  pageSize: 'letter',
  margins: { top: 40, right: 40, bottom: 40, left: 40 },
  fontSize: { name: 18, heading: 12, body: 10, small: 9 },
  fontFamily: 'Helvetica',
};

export function renderPDFDocument(
  viewModel: ATSResumeViewModel,
  options: PDFRenderOptions = {}
): PDFDocumentConfig {
  const config = { ...DEFAULT_PDF_OPTIONS, ...options };
  const margins = config.margins!;
  const fontSize = config.fontSize!;
  const fontFamily = config.fontFamily!;

  const content: PDFContent[] = [];

  content.push({
    text: viewModel.name,
    fontSize: fontSize.name,
    fontFamily,
    style: 'bold',
    margin: { bottom: 4 },
  });

  content.push({
    text: viewModel.headline,
    fontSize: fontSize.body,
    fontFamily,
    color: '#666666',
    margin: { bottom: 2 },
  });

  const contactLine: string[] = [];
  if (viewModel.location) contactLine.push(viewModel.location);
  if (viewModel.email) contactLine.push(viewModel.email);
  if (viewModel.phone) contactLine.push(viewModel.phone);

  if (contactLine.length > 0) {
    content.push({
      text: contactLine.join(' | '),
      fontSize: fontSize.small,
      fontFamily,
      color: '#666666',
      margin: { bottom: 2 },
    });
  }

  if (viewModel.links.length > 0) {
    const linkTexts = viewModel.links.map((link) => ({
      text: `${link.label}: `,
      fontSize: fontSize.small,
      fontFamily,
      color: '#666666',
      link: link.url,
    }));
    content.push({
      children: linkTexts,
      margin: { bottom: 8 },
    });
  }

  if (viewModel.summary) {
    content.push({
      text: 'SUMMARY',
      fontSize: fontSize.heading,
      fontFamily,
      style: 'bold',
      margin: { top: 8, bottom: 4 },
      decoration: 'underline',
    });
    content.push({
      text: viewModel.summary,
      fontSize: fontSize.body,
      fontFamily,
      margin: { bottom: 8 },
    });
  }

  if (viewModel.experience.length > 0) {
    content.push({
      text: 'EXPERIENCE',
      fontSize: fontSize.heading,
      fontFamily,
      style: 'bold',
      margin: { top: 8, bottom: 4 },
      decoration: 'underline',
    });

    for (const exp of viewModel.experience) {
      content.push({
        text: `${exp.role} — ${exp.company}`,
        fontSize: fontSize.body,
        fontFamily,
        style: 'bold',
        margin: { top: 4, bottom: 2 },
      });

      const dateRange = exp.endDate
        ? `${exp.startDate} – ${exp.endDate}`
        : `${exp.startDate} – Present`;
      const locationPart = exp.location ? ` | ${exp.location}` : '';

      content.push({
        text: `${dateRange}${locationPart}`,
        fontSize: fontSize.small,
        fontFamily,
        color: '#666666',
        margin: { bottom: 2 },
      });

      content.push({
        text: exp.description,
        fontSize: fontSize.body,
        fontFamily,
        margin: { bottom: 4 },
      });
    }
  }

  if (viewModel.education.length > 0) {
    content.push({
      text: 'EDUCATION',
      fontSize: fontSize.heading,
      fontFamily,
      style: 'bold',
      margin: { top: 8, bottom: 4 },
      decoration: 'underline',
    });

    for (const edu of viewModel.education) {
      const fieldPart = edu.field ? ` in ${edu.field}` : '';
      content.push({
        text: `${edu.degree}${fieldPart} — ${edu.institution}`,
        fontSize: fontSize.body,
        fontFamily,
        style: 'bold',
        margin: { top: 4, bottom: 2 },
      });

      const dateRange = edu.endDate
        ? `${edu.startDate} – ${edu.endDate}`
        : `${edu.startDate} – Present`;
      content.push({
        text: dateRange,
        fontSize: fontSize.small,
        fontFamily,
        color: '#666666',
        margin: { bottom: 4 },
      });
    }
  }

  if (viewModel.skills.length > 0) {
    content.push({
      text: 'SKILLS',
      fontSize: fontSize.heading,
      fontFamily,
      style: 'bold',
      margin: { top: 8, bottom: 4 },
      decoration: 'underline',
    });
    content.push({
      text: viewModel.skills.map((s) => s.name).join(', '),
      fontSize: fontSize.body,
      fontFamily,
      margin: { bottom: 8 },
    });
  }

  if (viewModel.projects.length > 0) {
    content.push({
      text: 'PROJECTS',
      fontSize: fontSize.heading,
      fontFamily,
      style: 'bold',
      margin: { top: 8, bottom: 4 },
      decoration: 'underline',
    });

    for (const project of viewModel.projects) {
      content.push({
        text: project.name,
        fontSize: fontSize.body,
        fontFamily,
        style: 'bold',
        margin: { top: 4, bottom: 2 },
      });

      if (project.url) {
        content.push({
          text: project.url,
          fontSize: fontSize.small,
          fontFamily,
          color: '#666666',
          margin: { bottom: 2 },
          link: project.url,
        });
      }

      content.push({
        text: project.description,
        fontSize: fontSize.body,
        fontFamily,
        margin: { bottom: 2 },
      });

      if (project.technologies.length > 0) {
        content.push({
          text: `Technologies: ${project.technologies.join(', ')}`,
          fontSize: fontSize.small,
          fontFamily,
          color: '#666666',
          margin: { bottom: 4 },
        });
      }
    }
  }

  return {
    pageSize: config.pageSize,
    pageMargins: margins,
    content,
  };
}

interface PDFContent {
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  style?: 'bold' | 'normal';
  color?: string;
  margin?: { top?: number; bottom?: number; left?: number; right?: number };
  decoration?: 'underline';
  link?: string;
  children?: PDFContent[];
}

interface PDFDocumentConfig {
  pageSize: string | undefined;
  pageMargins: { top: number; right: number; bottom: number; left: number } | undefined;
  content: PDFContent[];
}

export async function generatePDFBlob(viewModel: ATSResumeViewModel): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');
  const React = await import('react');
  const { Document, Page, Text, View, StyleSheet } = await import('@react-pdf/renderer');

  const styles = StyleSheet.create({
    page: {
      padding: 40,
      fontFamily: 'Helvetica',
    },
    name: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    headline: {
      fontSize: 10,
      color: '#666666',
      marginBottom: 2,
    },
    contact: {
      fontSize: 9,
      color: '#666666',
      marginBottom: 2,
    },
    link: {
      fontSize: 9,
      color: '#666666',
      marginBottom: 2,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: 'bold',
      marginTop: 8,
      marginBottom: 4,
      textDecoration: 'underline',
    },
    entryTitle: {
      fontSize: 10,
      fontWeight: 'bold',
      marginTop: 4,
      marginBottom: 2,
    },
    entryDate: {
      fontSize: 9,
      color: '#666666',
      marginBottom: 2,
    },
    body: {
      fontSize: 10,
      marginBottom: 4,
    },
    smallBody: {
      fontSize: 9,
      color: '#666666',
      marginBottom: 4,
    },
  });

  const Doc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'LETTER', style: styles.page },
      React.createElement(Text, { style: styles.name }, viewModel.name),
      React.createElement(Text, { style: styles.headline }, viewModel.headline),
      viewModel.location
        ? React.createElement(Text, { style: styles.contact }, viewModel.location)
        : null,
      viewModel.email || viewModel.phone
        ? React.createElement(
            Text,
            { style: styles.contact },
            [viewModel.email, viewModel.phone].filter(Boolean).join(' | ')
          )
        : null,
      viewModel.links.length > 0
        ? viewModel.links.map((link, i) =>
            React.createElement(Text, { key: i, style: styles.link }, `${link.label}: ${link.url}`)
          )
        : null,
      viewModel.summary
        ? React.createElement(
            View,
            null,
            React.createElement(Text, { style: styles.sectionTitle }, 'SUMMARY'),
            React.createElement(Text, { style: styles.body }, viewModel.summary)
          )
        : null,
      viewModel.experience.length > 0
        ? React.createElement(
            View,
            null,
            React.createElement(Text, { style: styles.sectionTitle }, 'EXPERIENCE'),
            ...viewModel.experience.flatMap((exp, i) => [
              React.createElement(
                Text,
                { key: `exp-title-${i}`, style: styles.entryTitle },
                `${exp.role} — ${exp.company}`
              ),
              React.createElement(
                Text,
                { key: `exp-date-${i}`, style: styles.entryDate },
                `${exp.endDate ? `${exp.startDate} – ${exp.endDate}` : `${exp.startDate} – Present`}${exp.location ? ` | ${exp.location}` : ''}`
              ),
              React.createElement(
                Text,
                { key: `exp-desc-${i}`, style: styles.body },
                exp.description
              ),
            ])
          )
        : null,
      viewModel.education.length > 0
        ? React.createElement(
            View,
            null,
            React.createElement(Text, { style: styles.sectionTitle }, 'EDUCATION'),
            ...viewModel.education.flatMap((edu, i) => [
              React.createElement(
                Text,
                { key: `edu-title-${i}`, style: styles.entryTitle },
                `${edu.degree}${edu.field ? ` in ${edu.field}` : ''} — ${edu.institution}`
              ),
              React.createElement(
                Text,
                { key: `edu-date-${i}`, style: styles.entryDate },
                edu.endDate ? `${edu.startDate} – ${edu.endDate}` : `${edu.startDate} – Present`
              ),
            ])
          )
        : null,
      viewModel.skills.length > 0
        ? React.createElement(
            View,
            null,
            React.createElement(Text, { style: styles.sectionTitle }, 'SKILLS'),
            React.createElement(
              Text,
              { style: styles.body },
              viewModel.skills.map((s) => s.name).join(', ')
            )
          )
        : null,
      viewModel.projects.length > 0
        ? React.createElement(
            View,
            null,
            React.createElement(Text, { style: styles.sectionTitle }, 'PROJECTS'),
            ...viewModel.projects.flatMap((project, i) => [
              React.createElement(
                Text,
                { key: `proj-title-${i}`, style: styles.entryTitle },
                project.name
              ),
              project.url
                ? React.createElement(
                    Text,
                    { key: `proj-url-${i}`, style: styles.smallBody },
                    project.url
                  )
                : null,
              React.createElement(
                Text,
                { key: `proj-desc-${i}`, style: styles.body },
                project.description
              ),
              project.technologies.length > 0
                ? React.createElement(
                    Text,
                    { key: `proj-tech-${i}`, style: styles.smallBody },
                    `Technologies: ${project.technologies.join(', ')}`
                  )
                : null,
            ])
          )
        : null
    )
  );

  return pdf(Doc).toBlob();
}
