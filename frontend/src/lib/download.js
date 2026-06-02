// Autentifikatsiyalangan fayl yuklab olish (cookie + xato → toast).
// <a href> o'rniga shu yordamchilar ishlatiladi: xato bo'lsa yangi tabda
// JSON ko'rsatish o'rniga react-hot-toast orqali tushunarli xabar chiqadi.
import api from './api';
import toast from 'react-hot-toast';

async function fetchBlob(url) {
  // skipErrorToast: interceptor umumiy toast chiqarmasin — pastda o'zimiz parse qilamiz
  const { data, headers } = await api.get(url, { responseType: 'blob', skipErrorToast: true });
  return { data, headers };
}

function filenameFromHeaders(headers, fallback) {
  const cd = headers?.['content-disposition'] || '';
  const m = /filename\*?=(?:UTF-8'')?["']?([^"';]+)/i.exec(cd);
  return m ? decodeURIComponent(m[1]) : fallback;
}

// Blob ichidagi JSON xatoni o'qib, toast ko'rsatadi
async function showBlobError(err) {
  let msg = 'Yuklab olishda xato yuz berdi';
  try {
    const data = err.response?.data;
    if (data instanceof Blob) {
      const json = JSON.parse(await data.text());
      msg = json.error || msg;
    } else {
      msg = data?.error || err.message || msg;
    }
  } catch { /* default xabar */ }
  toast.error(msg);
}

// Faylni diskka yuklab olish (Word va h.k.)
export async function downloadFile(url, fallbackName) {
  const tid = toast.loading('Tayyorlanmoqda...');
  try {
    const { data, headers } = await fetchBlob(url);
    const name = filenameFromHeaders(headers, fallbackName);
    const objUrl = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 10_000);
    toast.dismiss(tid);
  } catch (err) {
    toast.dismiss(tid);
    await showBlobError(err);
  }
}

// Faylni yangi tabda ochish (PDF ko'rish / chop etish)
export async function openFile(url) {
  const tid = toast.loading('Tayyorlanmoqda...');
  try {
    const { data } = await fetchBlob(url);
    const objUrl = URL.createObjectURL(data);
    window.open(objUrl, '_blank');
    setTimeout(() => URL.revokeObjectURL(objUrl), 60_000);
    toast.dismiss(tid);
  } catch (err) {
    toast.dismiss(tid);
    await showBlobError(err);
  }
}
