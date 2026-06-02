const prisma = require('../prisma');

// M-7: Audit payload ichidagi nozik (PII / maxfiy) kalitlar saqlanmasligi kerak.
const SENSITIVE_KEYS = ['password', 'token', 'secret', 'refreshtoken', 'jwt'];
const MAX_PAYLOAD_CHARS = 10_000;

// Rekursiv, case-insensitive redaksiya. Massivlar va ichma-ich obyektlar ham qamraladi.
function sanitizePayload(value) {
  if (value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map(sanitizePayload);
  }

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
      out[key] = '[REDACTED]';
    } else {
      out[key] = sanitizePayload(val);
    }
  }
  return out;
}

// M-7: cheksiz o'sishni cheklash — juda katta payload to'liq saqlanmaydi.
function capPayloadSize(payload) {
  try {
    const json = JSON.stringify(payload);
    if (json && json.length > MAX_PAYLOAD_CHARS) {
      return { _truncated: true, _originalSize: json.length };
    }
  } catch {
    // serializatsiya bo'lmasa (masalan circular) — xavfsiz placeholder
    return { _truncated: true };
  }
  return payload;
}

async function logAudit(userId, action, entityType, entityId, payload, req) {
  try {
    if (!userId) return; // Audit requires an authenticated user

    let ipAddress = null;
    if (req) {
      ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
    }

    let safePayload = undefined;
    if (payload !== undefined && payload !== null) {
      safePayload = capPayloadSize(sanitizePayload(payload));
    }

    await prisma.auditLog.create({
      data: {
        userId,
        action, // "create" | "update" | "delete"
        entityType, // "client" | "product" | "sale" | "payment" | "contract" | "specification" | "interaction" | "setting"
        entityId: entityId ? String(entityId) : null,
        payload: safePayload,
        ipAddress
      }
    });
  } catch (error) {
    console.error('Audit logging error:', error);
  }
}

module.exports = { logAudit, sanitizePayload };
