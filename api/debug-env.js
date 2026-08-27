// api/debug-env.js
// TEMPORARY diagnostic file — delete this once GEMINI_API_KEY issues are resolved.
// Visit http://localhost:3000/api/debug-env directly in your browser to see this.

export default function handler(req, res) {
  const key = process.env.GEMINI_API_KEY;
  res.status(200).json({
    keyIsSet: !!key,
    keyLength: key ? key.length : 0,
    keyStartsWith: key ? key.slice(0, 6) : null,
    nodeEnv: process.env.NODE_ENV || null,
    vercelEnv: process.env.VERCEL_ENV || null,
    allEnvKeysContainingGEMINI: Object.keys(process.env).filter(k => k.includes('GEMINI'))
  });
}