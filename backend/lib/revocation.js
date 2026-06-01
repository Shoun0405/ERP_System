// H-4: Token bekor qilish — DB ga HAR so'rovda urilmaslik uchun in-memory blocklist.
//
// Foydalanuvchi o'chirilganda/faolsizlantirilganda (yoki rol/huquq/parol o'zgarganda)
// uning userId si shu Set ga qo'shiladi. authMiddleware har so'rovda token ichidagi
// userId ni shu Set bilan solishtiradi va topilsa darhol 401 qaytaradi — DB so'rovsiz.
//
// Cheklovlar (ataylab tanlangan yengil dizayn):
//   • Process-ga xos: PM2 `instances=1` da to'liq ishlaydi; cluster/multi-instance da
//     har instance o'z Set iga ega bo'ladi (umumiy Redis kerak bo'lardi).
//   • Restart da tozalanadi: server qayta ishga tushsa, o'chirilgan foydalanuvchining
//     hali muddati o'tmagan tokeni (≤ JWT_TTL) qayta ishlashi mumkin. To'liq yechim —
//     H-4 Variant A (DB `RefreshToken` + qisqa access token). Joriy ko'lam (5-20 user) uchun yetarli.
const revokedUsers = new Set();

function revokeUser(userId) {
  if (userId) revokedUsers.add(String(userId));
}

// Foydalanuvchi qayta faollashtirilganda blocklist dan olib tashlash
function allowUser(userId) {
  if (userId) revokedUsers.delete(String(userId));
}

function isRevoked(userId) {
  return userId ? revokedUsers.has(String(userId)) : false;
}

module.exports = { revokeUser, allowUser, isRevoked };
