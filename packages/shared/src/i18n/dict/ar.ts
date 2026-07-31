/**
 * Arabic. Right-to-left, and the reason every bidi decision in this module
 * exists rather than being deferred.
 *
 * Arabic takes six plural forms and CLDR reports all six: `zero` (0), `one` (1),
 * `two` (2, the dual), `few` (3–10), `many` (11–99) and `other` (100+ and
 * fractions). "3 مستندات" and "11 مستندًا" are different words for the same noun.
 *
 * Bidi: every interpolated value — the portal URL, a form code like 1099-DIV, a
 * firm name in Latin script, a date — is wrapped by the renderer in
 * `U+2068 FSI … U+2069 PDI` because this locale record carries `dir: 'rtl'`.
 * Without that, an Arabic sentence containing a URL renders with its clauses in
 * the wrong order and the punctuation on the wrong side. In the HTML part of the
 * email those isolates become `<bdi>` elements and the container carries
 * `dir="rtl"`; in the plain-text part they stay as control characters, which is
 * what a plain-text reader needs.
 *
 * Reviewer note: with the dual, Arabic normally drops the numeral — "مستندان",
 * not "2 مستندان". The templates keep the numeral for consistency with the other
 * counts; a reviewer may prefer to rewrite those two sentences.
 */

import type { Dictionary } from '../types.ts';

export const ar: Dictionary = {
  locale: 'ar',
  review: 'machine',
  plural: {
    item: { zero: 'بند', one: 'بند', two: 'بندان', few: 'بنود', many: 'بندًا', other: 'بند' },
    document: {
      zero: 'مستند',
      one: 'مستند',
      two: 'مستندان',
      few: 'مستندات',
      many: 'مستندًا',
      other: 'مستند',
    },
    day: { zero: 'يوم', one: 'يوم', two: 'يومان', few: 'أيام', many: 'يومًا', other: 'يوم' },
  },
  chase: {
    warm: {
      subject: 'قائمة مستنداتك لدى {firmName} جاهزة',
      body: [
        'مرحبًا {clientFirstName}،',
        'أعددنا قائمة المستندات المطلوبة لإقرارك الضريبي هذا العام، اعتمادًا على إقرارك السابق. القائمة {totalCount} {totalCount#item}، وليس فيها بند لا تحتاجه فعلًا.',
        '{bullets}',
        'يمكنك الرفع مباشرة من هاتفك. الصور مقبولة، وسنتولى تعديلها وتسميتها.',
        '{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}: ما زلنا بحاجة إلى {topList}. الرفع: {portalUrl}. أرسل STOP للإلغاء.',
    },
    neutral: {
      subject: 'بقي {outstandingCount} {outstandingCount#document} لإقرارك الضريبي',
      body: ['مرحبًا {clientFirstName}،', '{lede}', '{bullets}', '{portalUrl}', '{signature}'],
      sms: '{firmName}: ما زلنا ننتظر {topList}. {portalUrl}. أرسل STOP للإلغاء.',
    },
    firm: {
      subject: 'ما زلنا بحاجة إلى: {topList}',
      body: [
        'مرحبًا {clientFirstName}،',
        'مضى {daysWaiting} {daysWaiting#day}. لا يمكننا البدء بإقرارك قبل وصول هذه المستندات:',
        '{bullets}',
        'إن كان أي بند في القائمة لا ينطبق عليك هذا العام، أخبرنا بالرد على هذه الرسالة وسنحذفه بدل أن نواصل السؤال عنه.',
        '{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}: {daysWaiting} يومًا وننتظر {topList}. لا يمكن بدء الإقرار. {portalUrl}. أرسل STOP للإلغاء.',
    },
    urgent: {
      subject: 'إقرارك متوقف — ينقصه {outstandingCount} {outstandingCount#item}',
      body: [
        '{clientFirstName}،',
        'لم يبق سوى هذه الخطوة لينتهي إقرارك، وننتظر {outstandingCount} {outstandingCount#document}:',
        '{bullets}',
        '{deadline}',
        'ارفعها من هنا، لن تستغرق أكثر من دقيقتين:\n{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}: ينقصنا {outstandingCount} مستندات وبقي {daysToDeadline} يومًا. {topList}. {portalUrl}. أرسل STOP للإلغاء.',
    },
    final: {
      subject: 'الأرجح طلب تمديد — تذكير أخير بالمستندات',
      body: [
        '{clientFirstName}،',
        'هذا آخر تذكير تلقائي منا. ما زال ينقصنا:',
        '{bullets}',
        'إن لم تصل خلال الأيام القليلة القادمة فسنقدم لك طلب تمديد ونستأنف العمل بعده. التمديد يمنحك وقتًا إضافيًا لتقديم الإقرار لا لدفع المستحق، وأي مبلغ متبقٍ تُحتسب عليه فوائد من {deadlineDate}.',
        '{portalUrl}',
        'إن كان هناك ما يعيقك، رد على هذه الرسالة وسنعالج الأمر مباشرة.',
        '{signature}',
      ],
      sms: '{firmName}: تذكير أخير. بدون {topList} سنقدم طلب تمديد. {portalUrl}. أرسل STOP للإلغاء.',
    },
  },
  s: {
    'list.fallback': 'بعض المستندات',
    'list.plus': '، و{restCount} غيرها',
    'bullet.more': '  …و{restCount} غيرها',
    'neutral.ledeSome':
      'شكرًا لك — وصلنا {doneCount} من {totalCount}. وما زلنا ننتظر {outstandingCount}:',
    'neutral.ledeNone': 'ما زلنا ننتظر {outstandingCount} {outstandingCount#item}:',
    'urgent.deadlineNear':
      'بقي {daysToDeadline} {daysToDeadline#day} على الموعد النهائي للتقديم. بعده سنضطر لطلب تمديد، والتمديد لا يؤجل موعد الدفع.',
    'urgent.deadlineFar': 'كلما طال الأمر زاد احتمال أن ينتهي بنا إلى طلب تمديد.',
    'item.fromIssuer': '{code} من {issuers}',

    'portal.title': 'مستنداتك لدى {firmName}',
    'portal.progress': 'وصل {receivedCount} من {totalCount}',
    'portal.needed': 'ما زال مطلوبًا',
    'portal.upload': 'رفع',
    'portal.uploadHint': 'صورة من هاتفك تكفي — سنعدّلها ونعيد تسميتها بأنفسنا.',
    'portal.allDone': 'هذا كل شيء. لا حاجة لإرسال المزيد.',
    'portal.whyAsked': 'لماذا نحتاج هذا',
    'portal.help': 'واجهتك مشكلة؟ رد على أي رسالة منا وسيجيبك شخص حقيقي.',
    'portal.language': 'اللغة',
    'portal.languageHint': 'غيّر اللغة التي نراسلك بها.',
    'status.pending': 'مطلوب',
    'status.received': 'وصل',
    'status.accepted': 'مقبول',
    'status.rejected': 'نحتاج نسخة أخرى',
    'status.waived': 'غير مطلوب',
  },
  docCode: {
    'crypto-report': 'سجل الأصول الرقمية',
    'profit-loss': 'قائمة الأرباح والخسائر',
    'balance-sheet': 'الميزانية العمومية',
    'mileage-log': 'سجل مسافات القيادة',
    'asset-schedule': 'مشتريات الأصول',
    'home-office': 'مكتب المنزل',
    'bank-statements': 'كشوف الحساب',
    'payroll-summary': 'ملخص الرواتب',
    'property-tax': 'ضريبة العقار',
    'rental-summary': 'إيرادات ومصاريف الإيجار',
    'closing-statement': 'بيان إتمام البيع',
    charitable: 'إيصالات التبرعات',
    'medical-expenses': 'المصاريف الطبية',
    childcare: 'رعاية الأطفال',
    'estimated-payments': 'الدفعات التقديرية',
    'k12-educator': 'مصاريف المعلمين',
    'energy-credit': 'إيصالات تحسين الطاقة',
    'photo-id': 'إثبات الهوية',
    'ssn-card': 'بطاقة الضمان الاجتماعي',
    'voided-check': 'بيانات الحساب البنكي',
    'prior-return': 'إقرار العام الماضي',
    'engagement-letter': 'خطاب التكليف',
    organizer: 'استمارة البيانات الضريبية',
    other: 'مستند آخر',
  },
};
