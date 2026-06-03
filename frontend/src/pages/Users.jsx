import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useModalKeys } from '../hooks/useModalKeys';
import { Plus, X, Trash2, Edit2, Shield, UserCheck, UserX, Key, Search } from 'lucide-react';

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

const MODULE_LABELS = {
  clients:      'Mijozlar',
  products:     'Mahsulotlar',
  contracts:    'Shartnomalar',
  sales:        'Savdolar',
  payments:     'To\'lovlar',
  interactions: 'Muloqotlar',
  reports:      'Hisobotlar',
  settings:     'Sozlamalar',
};

const EMPTY_FORM = { username: '', password: '', fullName: '', role: 'seller', isActive: true, permissions: null };

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // 'add' | 'edit'
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [delId, setDelId] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/users');
      setUsers(res.data);
    } catch {
      // API interceptor handles errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Modal ESC close handler
  useModalKeys(
    !!modal || !!delId,
    null,
    () => { setModal(null); setDelId(null); }
  );

  const handleOpenAdd = () => {
    setForm({ ...EMPTY_FORM, permissions: JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS)) });
    setEditId(null);
    setModal('add');
  };

  const handleOpenEdit = (u) => {
    setForm({
      username: u.username,
      password: '', // blank password on edit
      fullName: u.fullName,
      role: u.role,
      isActive: u.isActive,
      permissions: u.permissions 
        ? JSON.parse(JSON.stringify(u.permissions)) 
        : JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS))
    });
    setEditId(u.id);
    setModal('edit');
  };

  const handlePermissionChange = (module, action, checked) => {
    setForm(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [module]: {
          ...prev.permissions[module],
          [action]: checked
        }
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.username.trim()) {
      toast.error('Barcha majburiy maydonlarni to\'ldiring');
      return;
    }
    if (modal === 'add' && !form.password) {
      toast.error('Parol kiritish majburiy');
      return;
    }

    setSaving(true);
    try {
      if (modal === 'add') {
        await api.post('/api/users', form);
        toast.success('Yangi foydalanuvchi yaratildi');
      } else {
        // Send fields for update
        const payload = {
          fullName: form.fullName,
          role: form.role,
          isActive: form.isActive,
          permissions: form.permissions
        };
        if (form.password.trim() !== '') {
          payload.password = form.password;
        }
        await api.put(`/api/users/${editId}`, payload);
        toast.success('Foydalanuvchi yangilandi');
      }
      setModal(null);
      fetchUsers();
    } catch {
      // handled by api interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/users/${delId}`);
      toast.success('Foydalanuvchi o\'chirildi');
      setDelId(null);
      fetchUsers();
    } catch {
      // handled
    }
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.fullName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">Foydalanuvchilar (RBAC)</h2>
          <p className="text-xs text-[var(--text-3)] mt-0.5">Tizim foydalanuvchilari va ularning kirish huquqlarini boshqarish</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="btn btn-accent flex items-center gap-2 text-xs font-semibold py-2 px-4 rounded-lg cursor-pointer"
        >
          <Plus size={16} strokeWidth={2.2} />
          Foydalanuvchi qo'shish
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={15} className="text-[var(--text-3)]" />
          </span>
          <input
            type="text"
            placeholder="Foydalanuvchi nomi yoki to'liq ismi..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent)] w-full placeholder-[var(--text-3)]"
          />
        </div>
      </div>

      {/* Main Dense Table */}
      <div className="card p-0 overflow-hidden border border-[var(--border)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                <th className="px-5 py-3 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wider">To'liq ismi</th>
                <th className="px-5 py-3 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wider">Login (username)</th>
                <th className="px-5 py-3 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wider">Roli</th>
                <th className="px-5 py-3 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wider">Holati</th>
                <th className="px-5 py-3 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wider">Yaratilgan sana</th>
                <th className="px-5 py-3 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wider text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-5 py-3"><div className="h-4 bg-[var(--surface-2)] animate-pulse rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-5 py-12 text-center text-xs text-[var(--text-3)] font-medium">Foydalanuvchilar topilmadi</td>
                </tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-[var(--surface-2)] transition-colors">
                    <td className="px-5 py-3 text-xs font-semibold text-[var(--text)]">{u.fullName}</td>
                    <td className="px-5 py-3 text-xs font-mono text-[var(--text-2)]">{u.username}</td>
                    <td className="px-5 py-3 text-xs">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${
                        u.role === 'superAdmin'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400'
                          : u.role === 'admin'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                            : u.role === 'seller'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400'
                      }`}>
                        <Shield size={11} strokeWidth={2.5} />
                        {u.role === 'superAdmin' ? 'Super Admin' : u.role === 'admin' ? 'Admin' : u.role === 'seller' ? 'Sotuvchi' : 'Foydalanuvchi'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${
                        u.isActive 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' 
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400'
                      }`}>
                        {u.isActive ? (
                          <>
                            <UserCheck size={11} strokeWidth={2.5} />
                            Faol
                          </>
                        ) : (
                          <>
                            <UserX size={11} strokeWidth={2.5} />
                            Faolsiz
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-[var(--text-2)]">
                      {new Date(u.createdAt).toLocaleDateString('uz-UZ')}
                    </td>
                    <td className="px-5 py-3 text-xs text-right space-x-1">
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
                        title="Tahrirlash"
                      >
                        <Edit2 size={15} strokeWidth={2} />
                      </button>
                      <button
                        onClick={() => setDelId(u.id)}
                        className="p-1 text-red-500 hover:text-red-700 transition"
                        title="O'chirish"
                      >
                        <Trash2 size={15} strokeWidth={2} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in my-8">
            <div className="flex justify-between items-center px-6 py-4 border-b border-[var(--border)] bg-[var(--surface-2)]">
              <h3 className="text-sm font-semibold text-[var(--text)]">
                {modal === 'add' ? "Yangi foydalanuvchi qo'shish" : "Foydalanuvchini tahrirlash"}
              </h3>
              <button
                onClick={() => setModal(null)}
                className="text-[var(--text-3)] hover:text-[var(--text)] transition cursor-pointer"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                
                {/* Left Column: General Info */}
                <div className="space-y-4">
                  <div className="border-b border-[var(--border)] pb-2 mb-2">
                    <h4 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">Asosiy ma'lumotlar</h4>
                  </div>

                  {/* Full Name */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[var(--text-2)] uppercase">Foydalanuvchi to'liq ismi *</label>
                    <input
                      type="text"
                      required
                      value={form.fullName}
                      onChange={e => setForm({ ...form, fullName: e.target.value })}
                      placeholder="Masalan: Davlat Sher"
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                  </div>

                  {/* Username */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[var(--text-2)] uppercase">Login (username) *</label>
                    <input
                      type="text"
                      required
                      disabled={modal === 'edit'}
                      value={form.username}
                      onChange={e => setForm({ ...form, username: e.target.value.trim() })}
                      placeholder="Masalan: davlatsher"
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Password */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-semibold text-[var(--text-2)] uppercase">
                        Parol {modal === 'add' ? '*' : '(o\'zgartirish uchun)'}
                      </label>
                      {modal === 'edit' && <span className="text-[9px] text-[var(--text-3)] lowercase">yangilash ixtiyoriy</span>}
                    </div>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Key size={13} className="text-[var(--text-3)]" />
                      </span>
                      <input
                        type="password"
                        required={modal === 'add'}
                        value={form.password}
                        onChange={e => setForm({ ...form, password: e.target.value })}
                        placeholder={modal === 'add' ? "Kamida 6 ta belgi" : "O'zgarishsiz qoldirish uchun bo'sh qoldiring"}
                        className="w-full pl-9 pr-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      />
                    </div>
                  </div>

                  {/* Role Select */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[var(--text-2)] uppercase">Foydalanuvchi roli</label>
                    <select
                      value={form.role}
                      onChange={e => setForm({ ...form, role: e.target.value })}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    >
                      <option value="seller">Sotuvchi (Seller)</option>
                      <option value="admin">Administrator (Admin)</option>
                      <option value="superAdmin">Super Admin (butunlay o'chirish)</option>
                      <option value="user">Oddiy foydalanuvchi (User)</option>
                    </select>
                  </div>

                  {/* Is Active Toggle */}
                  <div className="flex items-center gap-3 pt-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={form.isActive}
                      onChange={e => setForm({ ...form, isActive: e.target.checked })}
                      className="w-4 h-4 rounded text-[var(--accent)] border-[var(--border)] focus:ring-[var(--accent)] cursor-pointer"
                    />
                    <label htmlFor="isActive" className="text-xs font-semibold text-[var(--text)] cursor-pointer select-none">
                      Foydalanuvchi faol holatda
                    </label>
                  </div>
                </div>

                {/* Right Column: Permission Matrix Grid */}
                <div className="space-y-4">
                  <div className="border-b border-[var(--border)] pb-2 mb-2">
                    <h4 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">Huquqlar matritsasi (Permission Matrix)</h4>
                  </div>

                  <div className="flex flex-col">
                    <p className="text-[11px] text-[var(--text-3)] mb-4 leading-relaxed">
                      Chap tomonda tizim modullari va o'ng tomonda ustunlarda ularga tegishli ruxsatnomalar ("ptichka").
                      {form.role === 'admin' && (
                        <span className="block mt-1 font-semibold text-amber-600 dark:text-amber-400">
                          ⚠️ Diqqat: Admin foydalanuvchilarga barcha huquqlar avtomatik beriladi!
                        </span>
                      )}
                    </p>
                    
                    <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--surface-2)] shadow-xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                            <th className="p-2.5 text-[10px] font-bold text-[var(--text-2)] uppercase tracking-wider">Modul</th>
                            <th className="p-2.5 text-[10px] font-bold text-[var(--text-2)] uppercase tracking-wider text-center">Ko'rish</th>
                            <th className="p-2.5 text-[10px] font-bold text-[var(--text-2)] uppercase tracking-wider text-center">Qo'shish</th>
                            <th className="p-2.5 text-[10px] font-bold text-[var(--text-2)] uppercase tracking-wider text-center">O'zgartirish</th>
                            <th className="p-2.5 text-[10px] font-bold text-[var(--text-2)] uppercase tracking-wider text-center">O'chirish</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)] text-xs">
                          {Object.entries(MODULE_LABELS).map(([modKey, modLabel]) => (
                            <tr key={modKey} className="hover:bg-[var(--surface-2)] transition-colors">
                              <td className="p-2.5 font-medium text-[var(--text)]">{modLabel}</td>
                              {['read', 'create', 'update', 'delete'].map(actKey => {
                                const isChecked = form.role === 'admin' ? true : !!form.permissions?.[modKey]?.[actKey];
                                const isDisabled = form.role === 'admin';
                                return (
                                  <td key={actKey} className="p-2.5 text-center">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      disabled={isDisabled}
                                      onChange={e => handlePermissionChange(modKey, actKey, e.target.checked)}
                                      className="w-4 h-4 rounded text-[var(--accent)] border-[var(--border)] focus:ring-[var(--accent)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mx-auto"
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

              </div>

              {/* Form Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="btn btn-outline text-xs font-semibold py-2 px-4 rounded-lg cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-accent text-xs font-semibold py-2 px-4 rounded-lg cursor-pointer disabled:opacity-60"
                >
                  {saving ? "Saqlanmoqda..." : "Saqlash"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {delId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl w-full max-w-sm shadow-2xl p-6 space-y-4 animate-in">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text)]">Rostdan ham o'chirmoqchimisiz?</h3>
              <p className="text-xs text-[var(--text-3)] mt-1">Ushbu foydalanuvchi tizimdan butunlay o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi!</p>
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-[var(--border)]">
              <button
                onClick={() => setDelId(null)}
                className="btn btn-outline text-xs font-semibold py-2 px-4 rounded-lg cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                onClick={handleDelete}
                className="btn btn-danger text-xs font-semibold py-2 px-4 rounded-lg cursor-pointer"
              >
                Ha, o'chirish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

