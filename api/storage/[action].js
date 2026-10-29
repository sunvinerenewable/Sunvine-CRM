import presignHandler from '../_lib/storagePresign.js';
import downloadHandler from '../_lib/storageDownload.js';
import deleteHandler from '../_lib/storageDelete.js';

export default async function handler(req, res) {
  const { action } = req.query;

  switch (action) {
    case 'presign':
      return presignHandler(req, res);
    case 'download':
      return downloadHandler(req, res);
    case 'delete':
      return deleteHandler(req, res);
    default:
      return res.status(404).json({ error: `Storage action '${action}' not found. Valid actions: presign, download, delete.` });
  }
}
