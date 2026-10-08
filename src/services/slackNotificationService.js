/**
 * Client-side Slack service stub.
 * Slack synchronization runs server-side via /api/customer-files and api/_lib/slackSync.js.
 */
export const slackNotificationService = {
  notify: async () => ({ success: true })
};

export default slackNotificationService;
