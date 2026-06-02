// Word (.docx) shablonlarini dasturiy yaratadi — PDF (HTML) bilan bir xil
// placeholderlar va dizayn. Placeholderlar contractHtmlData/specHtmlData
// (lib/docExport.js) qaytaradigan kalitlarga MOS: shu sabab .docx ham,
// PDF ham bitta ma'lumot manbaidan to'ladi.
//
// Ta'minotchi (ПОСТАВЩИК) rekvizitlari {{company...}} — Sozlamalardan keladi.
// Qayta yaratish:  node scripts/generate_templates.js

const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const TEMPLATE_DIR = path.join(__dirname, '..', 'templates');

function escapeXml(unsafe) {
  if (typeof unsafe !== 'string') return unsafe;
  return unsafe.replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[c]));
}

// A4 portret yoki landshaft sectPr
function sectPr(landscape) {
  return landscape
    ? `<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>`
    : `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>`;
}

function wrapDocumentBody(content, landscape = false) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${content}
    ${sectPr(landscape)}
  </w:body>
</w:document>`;
}

function makeParagraph(text, options = {}) {
  const b = options.bold ? '<w:b/>' : '';
  const i = options.italic ? '<w:i/>' : '';
  const sz = options.size ? `<w:sz w:val="${options.size}"/><w:szCs w:val="${options.size}"/>` : '';
  const jc = options.align ? `<w:jc w:val="${options.align}"/>` : '<w:jc w:val="both"/>';
  const before = options.before !== undefined ? `w:before="${options.before}"` : 'w:before="0"';
  const after = options.after !== undefined ? `w:after="${options.after}"` : 'w:after="120"';
  return `
    <w:p>
      <w:pPr>${jc}<w:spacing ${before} ${after} w:line="252" w:lineRule="auto"/></w:pPr>
      <w:r><w:rPr>${b}${i}${sz}</w:rPr><w:t xml:space="preserve">${options.raw ? text : escapeXml(text)}</w:t></w:r>
    </w:p>`;
}

// Bir paragraf ichida bir nechta run (qism-qismni highlight qilish uchun).
// runs: [{ text, bold, highlight }]  — highlight=true sariq marker.
function makeRichParagraph(runs, options = {}) {
  const jc = options.align ? `<w:jc w:val="${options.align}"/>` : '<w:jc w:val="both"/>';
  const before = options.before !== undefined ? `w:before="${options.before}"` : 'w:before="0"';
  const after = options.after !== undefined ? `w:after="${options.after}"` : 'w:after="120"';
  const sz = options.size ? `<w:sz w:val="${options.size}"/><w:szCs w:val="${options.size}"/>` : '';
  const r = runs.map(run => {
    const b = run.bold ? '<w:b/>' : '';
    const hl = run.highlight ? '<w:highlight w:val="yellow"/>' : '';
    const txt = run.raw ? run.text : escapeXml(run.text);
    return `<w:r><w:rPr>${b}${sz}${hl}</w:rPr><w:t xml:space="preserve">${txt}</w:t></w:r>`;
  }).join('');
  return `<w:p><w:pPr>${jc}<w:spacing ${before} ${after} w:line="252" w:lineRule="auto"/></w:pPr>${r}</w:p>`;
}

function makeTable(rows, colWidths = []) {
  let xml = '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>' +
    '<w:tblBorders>' +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(s =>
      `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`).join('') +
    '</w:tblBorders></w:tblPr>';
  if (colWidths.length) {
    xml += '<w:tblGrid>' + colWidths.map(w => `<w:gridCol w:w="${w}"/>`).join('') + '</w:tblGrid>';
  }
  for (const row of rows) {
    xml += '<w:tr>';
    for (const cell of row) {
      const b = cell.bold ? '<w:b/>' : '';
      const sz = cell.size ? `<w:sz w:val="${cell.size}"/><w:szCs w:val="${cell.size}"/>` : '';
      const jc = cell.align ? `<w:jc w:val="${cell.align}"/>` : '';
      const bg = cell.bg ? `<w:shd w:val="clear" w:fill="${cell.bg}"/>` : '';
      const span = cell.span ? `<w:gridSpan w:val="${cell.span}"/>` : '';
      const vMerge = cell.vMerge ? `<w:vMerge w:val="${cell.vMerge}"/>` : '';
      xml += `<w:tc><w:tcPr>${bg}${span}${vMerge}<w:tcMar>` +
        `<w:top w:w="60" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/>` +
        `<w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>` +
        `<w:vAlign w:val="center"/></w:tcPr>` +
        `<w:p><w:pPr>${jc}<w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>` +
        `<w:r><w:rPr>${b}${sz}</w:rPr><w:t xml:space="preserve">${cell.raw ? (cell.text ?? '') : escapeXml(cell.text ?? '')}</w:t></w:r></w:p></w:tc>`;
    }
    xml += '</w:tr>';
  }
  return xml + '</w:tbl>';
}

function writeDocx(filename, bodyXml, landscape = false) {
  const zip = new PizZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
  zip.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr>
    <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
    <w:sz w:val="22"/><w:szCs w:val="22"/>
  </w:rPr></w:rPrDefault></w:docDefaults>
</w:styles>`);
  zip.file('word/document.xml', wrapDocumentBody(bodyXml, landscape));
  fs.writeFileSync(path.join(TEMPLATE_DIR, filename),
    zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
  console.log(`Yaratildi: templates/${filename}`);
}

// ─── SHARTNOMA (ruscha) ──────────────────────────────────────────────────────
function generateContractTemplate() {
  let b = '';
  b += makeParagraph('ДОГОВОР № {{contractNumber}}', { bold: true, size: 30, align: 'center', after: 40 });
  b += makeParagraph('ПОСТАВКИ ТОВАРОВ', { bold: true, size: 24, align: 'center', after: 200 });

  // shahar — chap, sana — o'ng (ikki ustunli ko'rinmas jadval o'rniga oddiy paragraf)
  b += makeParagraph('г. Ангрен\t\t\t\t\t\t\t\t{{contractDate}}', { after: 200 });

  b += makeParagraph('1. ОБЩИЕ ПОЛОЖЕНИЯ', { bold: true, after: 80, align: 'center' });
  b += makeParagraph('Мы, нижеподписавшиеся {{companyName}}, в лице директора {{companyDirector}}, именуемое в дальнейшем «ПОСТАВЩИК» действующего на основании устава, с одной стороны, и {{buyerName}} именуемое в дальнейшем «ПОКУПАТЕЛЬ» в лице директора {{buyerDirector}} действующего на основании устава с другой стороны, заключили договор о следующем:');

  b += makeParagraph('2. ПРЕДМЕТ ДОГОВОРА.', { bold: true, before: 120, after: 80, align: 'center' });
  b += makeRichParagraph([
    { text: '2.1 «Поставщик» обязуется изготовить и передать «Покупателю», а «Покупатель» принять и оплатить продукцию, ' },
    { text: 'базальтовая вата (далее по тексту БВ)', highlight: true },
    { text: ', указанную в Приложении.' },
  ]);
  b += makeRichParagraph([
    { text: '2.2 Общая сумма договора составляет: ' },
    { text: '{{totalDigits}} ({{totalWords}})', raw: true, highlight: true },
    { text: ' сум с НДС.' },
  ]);
  b += makeParagraph('2.3 Качество продукции должно соответствовать представленной технической документации или предоставленному образцу.');
  b += makeParagraph('2.4. Цена продукции включает в себя все налоги и другие обязательные платежи, которые "Поставщик" обязан уплатить в бюджет, в связи с Поставкой (отгрузкой) продукции "Покупателю".');

  b += makeParagraph('3. СРОК ИСПОЛНЕНИЯ ДОГОВОРА И ПОРЯДОК РАСЧЕТОВ.', { bold: true, before: 120, after: 80, align: 'center' });
  b += makeParagraph('3.1 «Поставщик» передает продукцию (партию продукции) в течении 30-ти банковских дней, с момента зачисления денег на его расчетный счет.');
  b += makeParagraph('3.2 «Покупатель» рассчитывается за заказанную продукцию путем 100% предварительной оплаты, заявленной суммы, в течении 3-х банковских дней с момента подписания настоящего договора.');
  b += makeParagraph('3.3 Цены на продукцию указываются в Приложении (Спецификации) к настоящему договору и действуют до срока, указанного в Приложении (Спецификации). В случае наличия предоплаты на момент подписания новой Спецификации, продукция будет отпущена в пределах суммы, поступившей на расчетный счет из расчета цен, действующих на момент оплаты.');
  b += makeParagraph('3.4. Форма оплаты безналичный расчет.');

  b += makeParagraph('4. ОБЯЗАННОСТИ СТОРОН.', { bold: true, before: 120, after: 80, align: 'center' });
  b += makeParagraph('4.1 «Поставщик» обязуется передать продукцию «Покупателю» в срок, установленный п. 3.1 настоящего договора.');
  b += makeParagraph('4.2 «Покупатель» обязуется своевременно, согласно сроков и условий, установленных п. 3.2 настоящего договора принять и оплатить продукцию.');

  b += makeParagraph('5. ОТВЕТСТВЕННОСТЬ СТОРОН.', { bold: true, before: 120, after: 80, align: 'center' });
  b += makeParagraph('5.1 По вопросам не урегулированным в настоящем договоре, стороны несут ответственность за неисполнение или ненадлежащее исполнение обязательств, руководствуясь действующим Законодательством РУз, Законом "О договорно-правовой базе деятельности хозяйствующих субъектов от 29.08. 1998г. №670-I и гражданским кодексом РУз.');
  b += makeParagraph('5.2 Поставщик не несет ответственности за утрату товаром физических и механических свойств, в случае его транспортировки, хранения и использования Покупателем с нарушением требований ГОСТ 10499-95 и TS-25529339-01:2016, а также устных или письменных рекомендаций завода-изготовителя при продаже. Стороны согласились, что любые претензии и рекламации на товар после его использования будут считаться неправомерными.');
  b += makeParagraph('5.3 Поставщик обязуется предоставить данные о том, что является субъектом предпринимательства, облагаемый налогом на добавленную стоимость. При этом, Поставщик гарантирует уплату НДС по итогам отчетного периода, в случае неуплаты НДС и выставления санкций со стороны налоговых органов Республики Узбекистан в отношении Покупателя, данная санкция будет перевыставлена на счёт Поставщика.');

  b += makeParagraph('6. ОСОБЫЕ УСЛОВИЯ.', { bold: true, before: 120, after: 80, align: 'center' });
  b += makeParagraph('6.1 «Покупатель» вывозит товар со склада «Поставщика» своими силами и средствами.');
  b += makeParagraph('6.2 Стоимость продукции может быть изменена «Поставщиком», в связи с изменением цен на сырье, материалы, энергоресурсы и другие статьи затрат, влияющих на стоимость продукции. В случае поступления письменного сообщения от "Покупателя" о несогласии с изменением цен, настоящий Договор считается аннулированным, не пораждает никаких обязательств и не влечет никакой ответственности со стороны "Поставщика".');
  b += makeParagraph('6.3. По согласованию сторон допускается замена одного вида продукции "в ассортименте" другим.');
  b += makeParagraph('6.4. Цены являются договорными и зависят от сроков и условий поставки, а также ситуации на рынке.');
  b += makeParagraph('6.5 Стороны допускают факсимильное воспроизведение подписей (факсимиле), с помощью средств механического или иного копирования, а также использовать факсимиле на иных необходимых документах, являющихся обязательными при проведении сделок. При этом факсимильная подпись будет иметь силу подлинной подписи уполномоченного лица.');

  b += makeParagraph('7. УСЛОВИЯ ПОСТАВКИ ПРОДУКЦИИ.', { bold: true, before: 120, after: 80, align: 'center' });
  b += makeParagraph('7.1. Поставка товаров осуществляется самовывозом в течение 20 рабочих дней с момента поступления денежных средств на расчетный счет.');
  b += makeParagraph('7.2 Товары поставляются со склада производителя. Адрес: {{companyName}}, {{companyAddress}}.');

  b += makeParagraph('8. СРОК ДЕЙСТВИЯ ДОГОВОРА.', { bold: true, before: 120, after: 80, align: 'center' });
  b += makeParagraph('8.1. Настоящий Договор вступает в силу с момента его подписания Сторонами и действует до полного и надлежащего выполнения Сторонами всех своих обязательств по настоящему Договору.');

  b += makeParagraph('9. ПОРЯДОК РАЗРЕШЕНИЯ СПОРОВ.', { bold: true, before: 120, after: 80, align: 'center' });
  b += makeParagraph('9.1 Все споры и разногласия, которые могут возникнуть при исполнении настоящего Договора, будут по возможности разрешаться путем переговоров между сторонами.');
  b += makeParagraph('9.2 В случае невозможности разрешения споров путем переговоров, стороны после реализации предусмотренной законодательством, процедуры доступного урегулирования разногласий, передают их на рассмотрение в Экономический суд г. Ташкента в соответствии с действующим Законодательством Республики Узбекистан.');

  b += makeParagraph('10. ДОПОЛНИТЕЛЬНЫЕ УСЛОВИЯ', { bold: true, before: 120, after: 80, align: 'center' });
  b += makeParagraph('10.1 Все изменения и дополнения к настоящему Договору действительны, если они совершены в письменной форме и заверены полномочными представителями обеих сторон. Приложение к настоящему договору составляет его неотъемлемую часть.');

  b += makeParagraph('11. РЕКВИЗИТЫ СТОРОН:', { bold: true, before: 120, after: 80, align: 'center' });

  const R = (label, l, r) => [
    { text: `${label ? label + ': ' : ''}${l}`, raw: true, size: 20 },
    { text: `${label ? label + ': ' : ''}${r}`, raw: true, size: 20 },
  ];
  const req = [
    [{ text: 'ПОСТАВЩИК', bold: true, align: 'center', bg: 'F2F2F2', size: 20 },
     { text: 'ПОКУПАТЕЛЬ', bold: true, align: 'center', bg: 'F2F2F2', size: 20 }],
    R('', '{{companyName}}', '{{buyerName}}'),
    R('Адрес', '{{companyAddress}}', '{{buyerAddress}}'),
    R('Р/С', '{{companyAccount}}', '{{buyerAccount}}'),
    R('Банк', '{{companyBank}}', '{{buyerBank}}'),
    R('ИНН', '{{companyInn}}', '{{buyerInn}}'),
    R('МФО', '{{companyMfo}}', '{{buyerMfo}}'),
    R('Директор', '{{companyDirector}}', '{{buyerDirector}}'),
    [{ text: '_______________ М.П.', raw: true, size: 20 },
     { text: '_______________ М.П.', raw: true, size: 20 }],
  ];
  b += makeTable(req, [4953, 4953]);

  writeDocx('contract_template.docx', b, false);
}

// ─── СПЕЦИФИКАЦИЯ (ruscha, landshaft) ────────────────────────────────────────
function generateSpecTemplate() {
  let b = '';
  b += makeParagraph('Приложение к договору', { after: 20 });
  b += makeParagraph('г. Ангрен\t\t\t\t\t\t\t№ {{contractNumber}} от {{contractDate}}', { after: 120 });
  b += makeParagraph('СПЕЦИФИКАЦИЯ № {{specNumber}}', { bold: true, size: 26, align: 'center', after: 120 });
  b += makeParagraph('Поставщик: {{companyName}}', { after: 20 });
  b += makeParagraph('Покупатель: {{buyerName}} (ИНН: {{buyerInn}})', { after: 120 });

  const head = (t, span) => ({ text: t, bold: true, align: 'center', bg: 'F2F2F2', size: 18, span });
  const rows = [
    [
      head('Наименование'), head('Плотность,\nкг/м3'), head('Длина,\nмм'), head('Ширина,\nмм'),
      head('Толщина,\nмм'), head('Ед.изм.'), head('Цена за 1 ед.\nбез НДС'), head('НДС 12%'),
      head('Цена за 1 ед.\nс НДС'), head('Кол-во'), head('Сумма с НДС'),
    ],
    [
      { text: '{{#products}}{{name}}', raw: true, size: 18 },
      { text: '{{density}}', raw: true, align: 'center', size: 18 },
      { text: '{{length}}', raw: true, align: 'center', size: 18 },
      { text: '{{width}}', raw: true, align: 'center', size: 18 },
      { text: '{{thickness}}', raw: true, align: 'center', size: 18 },
      { text: '{{unit}}', raw: true, align: 'center', size: 18 },
      { text: '{{priceNoVat}}', raw: true, align: 'right', size: 18 },
      { text: '{{vat}}', raw: true, align: 'right', size: 18 },
      { text: '{{priceVat}}', raw: true, align: 'right', size: 18 },
      { text: '{{quantity}}', raw: true, align: 'center', size: 18 },
      { text: '{{rowTotal}}{{/products}}', raw: true, align: 'right', size: 18 },
    ],
  ];
  b += makeTable(rows, [2200, 900, 800, 800, 800, 900, 1300, 1100, 1300, 900, 1500]);

  b += makeParagraph('ИТОГО: {{totalDigits}} ({{totalWords}}) сум', { bold: true, before: 160, after: 240 });
  b += makeParagraph('Поставщик _______________ М.П.\t\t\t\tПокупатель _______________ М.П.', { before: 200 });

  writeDocx('spec_template.docx', b, true);
}

if (!fs.existsSync(TEMPLATE_DIR)) fs.mkdirSync(TEMPLATE_DIR, { recursive: true });
generateContractTemplate();
generateSpecTemplate();
console.log('Barcha shablonlar qayta yaratildi!');
