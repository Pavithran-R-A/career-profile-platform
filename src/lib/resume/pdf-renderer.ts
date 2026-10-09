import type { ATSResumeViewModel } from './ats-view-model';

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
                `${exp.role} - ${exp.company}`
              ),
              React.createElement(
                Text,
                { key: `exp-date-${i}`, style: styles.entryDate },
                `${exp.endDate ? `${exp.startDate} - ${exp.endDate}` : `${exp.startDate} - Present`}${exp.location ? ` | ${exp.location}` : ''}`
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
                `${edu.degree}${edu.field ? ` in ${edu.field}` : ''} - ${edu.institution}`
              ),
              React.createElement(
                Text,
                { key: `edu-date-${i}`, style: styles.entryDate },
                edu.endDate ? `${edu.startDate} - ${edu.endDate}` : `${edu.startDate} - Present`
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
