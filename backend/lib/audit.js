const prisma = require('../prisma');

async function logAudit(userId, action, entityType, entityId, payload, req) {
  try {
    if (!userId) return; // Audit requires an authenticated user
    
    let ipAddress = null;
    if (req) {
      ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
    }

    await prisma.auditLog.create({
      data: {
        userId,
        action, // "create" | "update" | "delete"
        entityType, // "client" | "product" | "sale" | "payment" | "contract" | "specification" | "interaction" | "setting"
        entityId: entityId ? String(entityId) : null,
        payload: payload ? payload : undefined,
        ipAddress
      }
    });
  } catch (error) {
    console.error('Audit logging error:', error);
  }
}

module.exports = { logAudit };
