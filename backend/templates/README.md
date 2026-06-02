# Hujjat shablonlari (Word .docx)

Bu papkaga ikkita Word fayl joylashtiring:

- `contract_template.docx` — Shartnoma shabloni
- `spec_template.docx` — Spetsifikatsiya shabloni

Dinamik qiymatlar `{{placeholder}}` ko'rinishida yoziladi (ikki jingalak qavs).
Jadval qatorlari (mahsulotlar) uchun `{{#products}} ... {{/products}}` loop ishlatiladi.

> **PDF eksport uchun:** server mashinasida **LibreOffice** o'rnatilgan bo'lishi
> kerak (`.docx` → `.pdf` konvertatsiya shu orqali yuqori sifatda bajariladi).
> Standart yo'llar avtomatik tekshiriladi; nostandart joyda bo'lsa `.env` da
> `SOFFICE_PATH=C:\...\soffice.exe` ni ko'rsating.

---

## contract_template.docx — mavjud o'zgaruvchilar

| Placeholder | Izoh |
|---|---|
| `{{contractNumber}}` | Shartnoma raqami |
| `{{contractDate}}` | Sana (DD.MM.YYYY) |
| `{{notes}}` | Izoh |
| `{{totalValue}}` | Umumiy summa (formatlangan, ru-RU) |
| `{{status}}` | Status |
| `{{seller}}` | Sotuvchi |
| `{{clientName}}` | Mijoz nomi |
| `{{clientInn}}` | Mijoz INN |
| `{{clientDirector}}` | Mijoz direktori |
| `{{clientPhone}}` | Mijoz telefoni |
| `{{clientAddress}}` | Mijoz manzili |
| `{{clientAccount}}` | Mijoz hisob raqami |
| `{{clientMfo}}` | Mijoz MFO |
| `{{companyName}}` `{{companyInn}}` `{{companyAddress}}` `{{companyPhone}}` `{{companyAccount}}` `{{companyMfo}}` `{{companyBank}}` `{{companyDirector}}` | Kompaniya (global sozlamalar) maydonlari |

## spec_template.docx — mavjud o'zgaruvchilar

| Placeholder | Izoh |
|---|---|
| `{{specNumber}}` | Spetsifikatsiya raqami |
| `{{specDate}}` | Sana (DD.MM.YYYY) |
| `{{notes}}` | Izoh |
| `{{totalValue}}` | Jami summa (formatlangan) |
| `{{contractNumber}}` `{{contractDate}}` | Bog'liq shartnoma |
| `{{clientName}}` ... `{{clientMfo}}` | Mijoz maydonlari (yuqoridagi kabi) |
| `{{companyName}}` ... `{{companyDirector}}` | Kompaniya maydonlari |

### Mahsulotlar jadvali (loop)

Word jadvalida bitta qator yarating va uni `{{#products}}` / `{{/products}}`
bilan o'rang. Qator ichidagi kataklar:

| Placeholder | Izoh |
|---|---|
| `{{index}}` | Tartib raqami (1, 2, 3, ...) |
| `{{article}}` | Mahsulot artikuli |
| `{{unit}}` | O'lchov birligi |
| `{{quantity}}` | Soni |
| `{{unitPriceVat}}` | Narx (QQS bilan) |
| `{{vatAmount}}` | QQS summasi |
| `{{rowTotal}}` | Qator jami |

Misol (Word jadvalining bitta qatori):

```
{{#products}} | {{index}} | {{article}} | {{unit}} | {{quantity}} | {{unitPriceVat}} | {{vatAmount}} | {{rowTotal}} {{/products}}
```
