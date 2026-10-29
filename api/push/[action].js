import notifyHandler from '../_lib/pushNotify.js';
import subscriptionHandler from '../_lib/pushSubscription.js';

export default async function handler(req, res) {
  const { action } = req.query;

  switch (action) {
    case 'notify':
      return notifyHandler(req, res);
    case 'subscription':
      return subscriptionHandler(req, res);
    default:
      return res.status(404).json({ error: `Push action '${action}' not found. Valid actions: notify, subscription.` });
  }
}
