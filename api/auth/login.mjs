import { getApp } from '../_app.mjs';

// Keep this route explicit because Vercel's filesystem routing should send
// POST /api/auth/login directly to this function.
export default async function handler(req, res) {
  const app = await getApp();
  return app(req, res);
}
