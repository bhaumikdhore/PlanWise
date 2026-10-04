import LegalPage from '../../components/legal/LegalPage';

const sections = [
  {
    title: 'Information Planwise handles',
    paragraphs: [
      'Planwise is a productivity and team collaboration service. The information handled depends on the features you use and what you or your workspace choose to provide.',
    ],
    items: [
      'Account and profile details such as your name, email address, profile photo, job information, preferences, and authentication identifiers.',
      'Workspace and collaboration content, including projects, tasks, comments or activity, team membership, notifications, and files or file metadata you add.',
      'Meeting and calendar details you create or choose to connect, which may include event titles, times, participants, descriptions, or locations.',
      'AI prompts, responses, and the relevant Planwise context used to answer a request, such as selected task, project, or personal planning data.',
      'Basic technical and diagnostic information needed to operate, protect, and troubleshoot the service.',
    ],
  },
  {
    title: 'Sign-in and Google services',
    paragraphs: [
      'You may sign in using email/password or Google authentication. Authentication is provided through Supabase Auth; when you choose Google sign-in, Google processes the authentication flow under its own privacy terms. Planwise receives the account information made available by the selected sign-in method.',
      'Connecting Google Calendar or another Google feature is optional. Planwise accesses only the information needed for the feature you enable and permissions you grant. You can revoke Google access through your Google account settings; some connected functionality may then stop working.',
    ],
  },
  {
    title: 'How information is used',
    paragraphs: [
      'Information is used to provide and maintain accounts, workspaces, tasks, meetings, files, notifications, preferences, and requested AI features; to authenticate users; to keep the service reliable and secure; and to respond to support or account requests.',
      'Workspace content is made available to other workspace or project members according to the product’s roles, sharing choices, and access controls. Do not place information in a shared workspace unless you are permitted to share it there.',
    ],
  },
  {
    title: 'AI features',
    paragraphs: [
      'When you use an AI feature, your prompt and relevant authorized context may be sent from Planwise’s server-side service to Google Gemini to generate a response. Context is intended to be limited to information the signed-in user is authorized to access and that is relevant to the request.',
      'AI outputs can be incomplete or incorrect and should be reviewed. AI suggestions do not create, assign, delete, or change tasks unless you separately review and approve an action presented by Planwise. Avoid submitting sensitive information that is not needed for your request.',
    ],
  },
  {
    title: 'Storage and third-party services',
    paragraphs: [
      'Planwise uses Supabase for application authentication, database, and storage services. Google services may be used for sign-in, calendar connections, or Gemini AI when those features are used. These providers process information to deliver their services under their own terms and privacy notices.',
      'The service may rely on other infrastructure or operational providers as it develops. Before publication, the Planwise operator should identify any additional providers actually in use and link to their current privacy notices.',
    ],
  },
  {
    title: 'Cookies and browser storage',
    paragraphs: [
      'Planwise and its authentication provider may use cookies or similar browser storage that is necessary to maintain a sign-in session, security state, and user preferences. The application may also use browser storage for preferences or session continuity. If analytics, advertising, or other optional technologies are used, the operator should list them here and explain the available choices before publication.',
      'You can manage cookies through your browser. Blocking essential storage may prevent sign-in or other features from working correctly.',
    ],
  },
  {
    title: 'Sharing and visibility',
    paragraphs: [
      'Planwise does not make personal workspace content public by default. Content you add to a team workspace or project may be visible to authorized members, including workspace administrators, depending on the feature and access rules. Information may also be processed by the service providers described above or disclosed when needed to protect the service or respond to a valid request.',
    ],
  },
  {
    title: 'Security and retention',
    paragraphs: [
      'Planwise uses access controls and security measures intended to protect information. No internet transmission or storage system can be guaranteed secure, and you should protect your sign-in credentials and use care when sharing workspace content.',
      'Information is retained while needed to provide the service, maintain workspace activity, meet operational needs, or address account requests. Exact retention periods, including backup expiration, depend on the service configuration and should be confirmed by the operator before publication.',
    ],
  },
  {
    title: 'Your choices and account deletion',
    paragraphs: [
      'You can review or update profile information and preferences in Planwise where those controls are available. You may request access to, correction of, or deletion of information associated with your account by contacting [Planwise privacy contact email]. The operator may need to verify the request before acting.',
      'To request account deletion, contact [Planwise account deletion contact or instructions]. Deletion may remove or de-identify account information, but shared workspace content, records required for operation, and backup copies may not disappear immediately. The operator should document its actual deletion and retention process here.',
    ],
  },
  {
    title: 'Contact and updates',
    paragraphs: [
      'For privacy questions or requests, contact [Planwise privacy contact email]. Service operator: [Legal entity or individual operating Planwise]. Mailing address, if applicable: [Business mailing address]. These fields are intentional placeholders and must be completed before this policy is published as a final policy.',
      'If this policy changes, the updated version and effective date will be posted here. The operator should describe any required notice process based on the changes and the service’s actual practices.',
    ],
  },
];

export default function PrivacyPage({ onNavigate }) {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="A clear overview of the information used to provide Planwise and the choices available to you."
      sections={sections}
      onNavigate={onNavigate}
    />
  );
}
