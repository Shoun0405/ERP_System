const router = require('express').Router();
const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { userCreateSchema, userUpdateSchema } = require('./_schemas');
const { logAudit } = require('../lib/audit');

const DEFAULT_PERMISSIONS = {
  clients:      { read: true, create: true, update: true, delete: false },
  products:     { read: true, create: false, update: false, delete: false },
  contracts:    { read: true, create: true, update: true, delete: false },
  sales:        { read: true, create: true, update: true, delete: false },
  payments:     { read: true, create: true, update: false, delete: false },
  interactions: { read: true, create: true, update: true, delete: true },
  reports:      { read: true, create: false, update: false, delete: false },
  settings:     { read: false, create: false, update: false, delete: false },
};

// Enforce auth and admin role on all user routes
router.use(authMiddleware);
router.use(requireRole('admin'));

// GET /api/users
router.get('/', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        permissions: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// POST /api/users
router.post('/', async (req, res, next) => {
  try {
    const parsed = userCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { username, password, fullName, role, isActive, permissions } = parsed.data;

    // Check unique username
    const existing = await prisma.user.findUnique({
      where: { username }
    });
    if (existing) {
      return res.status(409).json({ error: 'Ushbu foydalanuvchi nomi band' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Set default permissions if not provided
    const userPermissions = permissions || DEFAULT_PERMISSIONS;

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        fullName,
        role,
        isActive,
        permissions: userPermissions
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        permissions: true,
        createdAt: true
      }
    });

    await logAudit(req.user.id, 'create', 'user', user.id, { username, fullName, role, isActive }, req);

    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = userUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { fullName, password, role, isActive, permissions } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id }
    });
    if (!user) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    }

    const updateData = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) {
      // Don't allow self-deactivation
      if (id === req.user.id && !isActive) {
        return res.status(400).json({ error: 'O\'zingizning hisobingizni faolsizlantira olmaysiz' });
      }
      updateData.isActive = isActive;
    }
    if (password && password.trim() !== '') {
      updateData.password = await bcrypt.hash(password, 10);
    }
    if (permissions !== undefined) {
      updateData.permissions = permissions;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        permissions: true,
        createdAt: true,
        updatedAt: true
      }
    });

    await logAudit(req.user.id, 'update', 'user', id, { fullName, role, isActive }, req);

    res.json(updatedUser);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ error: 'O\'zingizning hisobingizni o\'chira olmaysiz' });
    }

    const user = await prisma.user.findUnique({
      where: { id }
    });
    if (!user) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    }

    await prisma.user.delete({
      where: { id }
    });

    await logAudit(req.user.id, 'delete', 'user', id, { username: user.username }, req);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
