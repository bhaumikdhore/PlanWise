import LegalPage from '../../components/legal/LegalPage';

const sections = [
  {
    title: 'Using Planwise',
    paragraphs: [
      'These Terms of Service describe the basic rules for using Planwise, a productivity and team collaboration platform. By accessing or using the service, you agree to these terms. If you do not agree, do not use the service.',
      'The service operator is [Legal entity or individual operating Planwise]. Contact details and any applicable jurisdiction are intentionally left for the operator to complete before publication.',
    ],
  },
  {
    title: 'Your account',
    paragraphs: [
      'You are responsible for providing accurate account information, protecting your credentials, and activity carried out through your account. Sign-in may be provided by Supabase Auth using email/password or Google authentication. Your use of Google services is also subject to Google’s applicable terms.',
      'Tell the Planwise operator promptly if you believe your account has been accessed without permission. Do not share credentials or attempt to access another person’s account.',
    ],
  },
  {
    title: 'Workspaces and collaboration',
    paragraphs: [
      'Planwise lets users create or join workspaces and collaborate on projects, tasks, meetings, and files. Workspace owners and administrators may manage membership and access. Content placed in a shared project or workspace may be seen and acted on by members with the relevant permissions.',
      'You are responsible for choosing the correct workspace and sharing content only with people who should have access. Personal or private content should be kept out of shared spaces.',
    ],
  },
  {
    title: 'Your content and permissions',
    paragraphs: [
      'You are responsible for the content you submit or upload and for having permission to use and share it. To provide the features you request, Planwise must store or process content you choose to use with collaboration, file storage, notifications, and AI assistance.',
      'Do not upload unlawful content, content that infringes another person’s rights, malicious code, or information you are not authorized to share. [The operator should insert the approved content ownership and license terms here before publication.]',
    ],
  },
  {
    title: 'Tasks, meetings, and integrations',
    paragraphs: [
      'Task assignments, due dates, meeting details, and connected calendar data are provided by users or authorized integrations. You are responsible for checking details before relying on them and for maintaining any permissions you grant to connected providers.',
      'Google Calendar and other third-party integrations are subject to their own terms, availability, and privacy practices. Disconnecting an integration may limit related Planwise features.',
    ],
  },
  {
    title: 'AI features',
    paragraphs: [
      'Planwise AI can summarize authorized context and suggest plans, priorities, or next steps. AI output may be inaccurate, incomplete, or unsuitable for your situation; review it before relying on it. It is not professional advice.',
      'AI-generated suggestions do not themselves change your tasks or workspace. Where Planwise offers an action based on a suggestion, you must review and approve that action. You remain responsible for actions you approve and for the content sent in prompts.',
    ],
  },
  {
    title: 'Acceptable use',
    paragraphs: ['You agree not to:'],
    items: [
      'Use Planwise to violate applicable rules or another person’s rights.',
      'Probe, disrupt, or bypass authentication, authorization, or other security controls.',
      'Access or disclose workspace information without permission.',
      'Interfere with the service, attempt to overload it, or use it to distribute malicious software.',
      'Misrepresent AI-generated content as verified where that would mislead others.',
    ],
  },
  {
    title: 'Service providers and availability',
    paragraphs: [
      'Planwise depends on providers such as Supabase for authentication, database, and storage, and Google for selected sign-in, calendar, or AI features. Provider terms may apply to your use of those features.',
      'Features may change as the service is developed. No service-level availability or support commitment is stated on this page; the operator should add any actual commitments here before publication.',
    ],
  },
  {
    title: 'Suspension, termination, and deletion',
    paragraphs: [
      'You may stop using Planwise and request account deletion by contacting [Planwise account contact or deletion instructions]. Workspace owners may remove members from a workspace. The operator should specify any grounds and process for restricting or closing accounts before publication.',
      'Account deletion may affect access to projects, tasks, files, and other workspace content. Shared content may remain available to a workspace where appropriate, and backups may persist until they expire under the operator’s retention process.',
    ],
  },
  {
    title: 'Changes, governing terms, and contact',
    paragraphs: [
      'The operator may update these terms by posting a revised version with a new effective date. Before publication, complete [Governing jurisdiction, if applicable] and [Planwise legal contact email], and determine how users will be notified of material changes.',
      'Questions about these terms: [Planwise legal contact email]. Operator: [Legal entity or individual operating Planwise]. Address, if applicable: [Business mailing address]. These placeholders must be completed and reviewed before these terms are treated as final.',
    ],
  },
];

export default function TermsPage({ onNavigate }) {
  return (
    <LegalPage
      title="Terms of Service"
      intro="The terms for using Planwise to plan work, collaborate with your team, and use connected features."
      sections={sections}
      onNavigate={onNavigate}
    />
  );
}
