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
    'portal.loadFailed': 'تعذّر تحميل قائمتك',
    'portal.loadFailedHint':
      'تحقّق من اتصالك وأعد تحميل الصفحة. كل ما أرسلته محفوظ.',
    'portal.emptyTitle': 'لا شيء مطلوب الآن',
    'portal.emptyHint': 'عندما تحتاج {firmName} مستندًا منك، سيظهر هنا.',
    'portal.somethingElse': 'هل من شيء آخر؟',

    'upload.gotItIssuer': 'وصلنا — {code} من {issuer}.',
    'upload.gotItCode': 'وصلنا — {code}.',
    'upload.gotItSaved': 'وصلنا — حفظناه في ملفك.',
    'upload.preparing': 'جارٍ التحضير',
    'upload.failed': 'لم يكتمل رفع هذا الملف.',
    'upload.unreadable': 'تعذّرت قراءة هذه الصورة. جرّب صورة أوضح.',
    'upload.undo': 'تراجع',
    'upload.undoLabel': 'تراجع — إزالة {name}',
    'upload.removing': 'جارٍ الإزالة…',
    'upload.removingLabel': 'جارٍ إزالة {name}',

    'signin.working': 'جارٍ تسجيل دخولك بأمان…',
    'signin.confirmTitle': 'أكّد بريدك الإلكتروني',
    'signin.confirmBody':
      'هذا الرابط لم يحمل بريدك، لذا نحتاجه مرة واحدة للتأكد من أنك أنت. اكتب العنوان الذي أرسل إليه محاسبك الرابط — هذا كل ما نتحقق منه، ولا حاجة لكلمة مرور.',
    'signin.emailLabel': 'البريد الإلكتروني',
    'signin.continue': 'متابعة',
    'signin.expiredTitle': 'سنرسل لك رابطًا جديدًا',
    'signin.expiredBody':
      'انتهت صلاحية هذا الرابط الآمن أو أنه استُخدم من قبل. يمكننا إرسال رابط جديد.',
    'signin.expiredShort': 'انتهت صلاحية هذا الرابط الآمن.',
    'signin.yourEmail': 'بريدك الإلكتروني',
    'signin.sendLink': 'أرسل لي رابطًا جديدًا',
    'signin.sentTitle': 'تحقّق من بريدك',
    'signin.sentBody':
      'أرسلنا رابطًا آمنًا إلى {email}. افتحه على هذا الجهاز وستدخل — بلا كلمة مرور تحفظها.',

    'status.pending': 'مطلوب',
    'status.received': 'وصل',
    'status.accepted': 'مقبول',
    'status.rejected': 'نحتاج نسخة أخرى',
    'status.waived': 'غير مطلوب',
    'portal.done': 'مكتمل · {doneCount}',
    'portal.uploadedCount': 'رُفع {uploadedCount} من {expectedCount}',
    'portal.private': 'خاص',
    'portal.needsAnotherTry': 'يحتاج محاولة أخرى: {detail}',
    'portal.yourAccountant': 'محاسبك',
    'portal.somethingElseHint':
      'لديك مستند ليس في القائمة؟ أضفه هنا وستتولى {firmName} أمره.',

    'upload.percent': '{percent}٪',
    'upload.tryAgain': 'أعد المحاولة',
    'upload.remove': 'إزالة',
    'upload.cancel': 'إلغاء',
    'upload.chooseFiles': 'اختر من ملفاتك',
    'upload.dropPrompt': 'اسحب صورة أو ملف {format} إلى هنا، أو',
    'upload.chooseFile': 'اختر ملفًا',
    'upload.unsupported': 'هذا النوع من الملفات غير مدعوم. صوّر المستند أو ارفع ملف {format}.',
    'upload.empty': 'يبدو هذا الملف فارغًا. جرّب ملفًا آخر.',
    'upload.tooLarge': 'هذا الملف أكبر من اللازم — الحد الأقصى {limit}.',
    'upload.photoTooLarge': 'هذه الصورة أكبر من اللازم — الحد الأقصى {limit}.',
    'upload.heicUnreadable':
      'تعذّرت قراءة هذه الصورة على هذا الجهاز. أعد التقاطها أو ارفع ملف {format}.',
    'upload.heicFailed': 'تعذّرت معالجة هذه الصورة. جرّب ملف {format} بدلًا منها.',
  },
  reason: {
    'reason.engagement': 'مطلوب قبل أن نبدأ العمل.',
    'reason.photoId': 'نحتاجه للتحقق من هويتك عند التقديم الإلكتروني.',
    'reason.photoIdBoth': 'يحتاج الزوجان كلاهما إثبات هوية بصورة سارية للتقديم الإلكتروني.',
    'reason.ipPin':
      'استخدمت رقم حماية الهوية من مصلحة الضرائب في إقرار {year}. تصدر المصلحة رقمًا جديدًا كل ديسمبر.',
    'reason.priorReturn': 'أرسل إقرار العام الماضي كاملًا وسنبني بقية هذه القائمة منه تلقائيًا.',

    'reason.w2Issuers': 'كان لديك العام الماضي {count} {code} — من {issuers}.',
    'reason.w2IssuersMany': 'كان لديك العام الماضي {count} {code} — من {issuers}.',
    'reason.w2Wages': 'أظهر إقرارك لعام {year} رواتب بقيمة {amount}.',
    'reason.w2Each': 'واحد من كل جهة عمل.',

    'reason.interestIssuers': 'حصلت العام الماضي على فوائد من {issuers}.',
    'reason.interestAmount': 'أظهر إقرارك لعام {year} دخل فوائد بقيمة {amount}.',
    'reason.dividendsIssuers': 'حصلت العام الماضي على أرباح أسهم من {issuers}.',
    'reason.dividendsAmount': 'أظهر إقرارك لعام {year} أرباح أسهم بقيمة {amount}.',
    'reason.brokerIssuers':
      'قدّمت {code} العام الماضي بعمليات لدى {issuers}. نحتاج كشف الحساب الموحّد كاملًا، بما فيه صفحات تكلفة الشراء.',
    'reason.brokerSchedule':
      'قدّمت {code} العام الماضي، لذا نحتاج {code2} الموحّد من وسيطك — مع تفصيل تكلفة الشراء.',

    'reason.retirement': 'أظهر إقرارك لعام {year} مبلغ {amount} من حساب تقاعد أو معاش أو دخل سنوي.',
    'reason.socialSecurity': 'أوردت العام الماضي {amount} من مستحقات الضمان الاجتماعي.',
    'reason.unemployment': 'ورد العام الماضي تعويض بطالة أو استرداد ضريبة من الولاية.',

    'reason.scheduleCMany': 'قدّمت {count} {code} العام الماضي — قائمة أرباح وخسائر لكل نشاط.',
    'reason.scheduleCIncome':
      'قدّمت {code} العام الماضي بصافي دخل نشاط قدره {amount}. قائمة أرباح وخسائر لسنة كاملة هي أسرع طريق لإنهاء الأمر.',
    'reason.scheduleC':
      'قدّمت {code} العام الماضي. قائمة أرباح وخسائر لسنة كاملة هي أسرع طريق لإنهاء الأمر.',
    'reason.necIssuers': 'استلمت العام الماضي {code} من {issuers}.',
    'reason.necSelfEmployed': 'أوردت العام الماضي دخلًا من العمل الحر — أرسل أي {code} يصلك.',
    'reason.paymentAppIssuers':
      'استلمت العام الماضي {code} من {issuers}. حد الإبلاغ يتراجع سنة بعد سنة، فتوقّع واحدًا آخر.',
    'reason.paymentApp':
      'استلمت العام الماضي {code}. حد الإبلاغ يتراجع سنة بعد سنة، فتوقّع واحدًا آخر.',
    'reason.mileage':
      'طالبت العام الماضي بمصاريف مركبة. تشترط مصلحة الضرائب سجل مسافات مدوّنًا أولًا بأول، فأرسل دفترك أو ملف التطبيق.',
    'reason.homeOffice':
      'طالبت العام الماضي بخصم مكتب المنزل — نحتاج مساحة هذا العام مع فواتير المرافق والإيجار أو فوائد الرهن والتأمين.',
    'reason.assets':
      'أرسل فواتير كل ما اشتراه النشاط بأكثر من 2500 دولار — معدات أو مركبات أو تحسينات.',
    'reason.payroll': 'تقارير الرواتب في نهاية العام ({codes}) تطابق الأجور المذكورة في الإقرار.',
    'reason.bankStatements':
      'كان لديك العام الماضي دخل من نشاط تجاري دون ملف محاسبي. كشوف اثني عشر شهرًا تكفي لنعدّ لك قائمة الأرباح والخسائر.',

    'reason.k1PartnershipIssuers':
      'لديك حصص في {issuers}. نماذج {code} من الشراكات تتأخر عادة — أرسل كل واحد فور وصوله.',
    'reason.k1Partnership': 'استلمت العام الماضي {count} {code} من شراكة.',
    'reason.k1PartnershipMany': 'استلمت العام الماضي {count} {code} من شراكات.',
    'reason.k1SCorpIssuers': 'أنت مساهم في {issuers}.',
    'reason.k1SCorp': 'استلمت العام الماضي {count} {code} من شركة إس.',
    'reason.k1SCorpMany': 'استلمت العام الماضي {count} {code} من شركات إس.',
    'reason.k1Trust': 'كنت العام الماضي مستفيدًا من صندوق ائتماني أو تركة.',

    'reason.rentalMany':
      'أظهر {code} العام الماضي {count} عقارات مؤجرة — أرسل الإيرادات والمصاريف لكل عقار.',
    'reason.rentalOne':
      'قدّمت {code} العام الماضي. أرسل إجمالي الإيجار المحصّل خلال السنة مع مصاريف العقار.',
    'reason.mortgageIssuers': 'دفعت العام الماضي فوائد رهن عقاري إلى {issuers}.',
    'reason.mortgage': 'خصمت العام الماضي فوائد رهن عقاري.',
    'reason.propertyTax': 'خصمت العام الماضي ضرائب عقارية.',
    'reason.closing': 'فقط إذا اشتريت أو بعت أو أعدت تمويل عقار هذا العام.',

    'reason.charitableGave':
      'فصّلت خصوماتك العام الماضي وتبرعت بمبلغ {amount}. كل تبرع يتجاوز 250 دولارًا يحتاج إقرارًا خطيًا من الجهة الخيرية.',
    'reason.charitable':
      'فصّلت خصوماتك العام الماضي. كل تبرع يتجاوز 250 دولارًا يحتاج إقرارًا خطيًا من الجهة الخيرية.',
    'reason.medical': 'طالبت العام الماضي بمصاريف طبية قدرها {amount}.',
    'reason.studentLoan': 'خصمت العام الماضي فوائد قرض دراسي.',
    'reason.education': 'طالبت العام الماضي بخصم ضريبي تعليمي.',
    'reason.childcare':
      'طالبت العام الماضي بخصم رعاية الأطفال والمعالين. نحتاج اسم مقدّم الرعاية وعنوانه ورقمه الضريبي — لا المبلغ وحده.',
    'reason.ira': 'خصمت العام الماضي اشتراكًا في حساب تقاعد فردي.',
    'reason.hsa': 'قدّمت العام الماضي النموذج {code} الخاص بحساب التوفير الصحي.',
    'reason.hsaSpend': 'نحتاجه إذا أنفقت من حساب التوفير الصحي هذا العام.',
    'reason.energy': 'طالبت العام الماضي بخصم ضريبي لكفاءة الطاقة في المنزل.',
    'reason.educator': 'طالبت العام الماضي بخصم مصاريف المعلمين.',
    'reason.marketplace':
      'كان لديك العام الماضي تأمين من سوق التأمين الصحي. بدون النموذج {code} ترفض مصلحة الضرائب الإقرار من أساسه.',

    'reason.estimatesTotal':
      'دفعت العام الماضي دفعات تقديرية مجموعها {amount}. نحتاج تاريخ كل دفعة ومبلغها بدقة.',
    'reason.estimates':
      'دفعت العام الماضي دفعات تقديرية. نحتاج تاريخ كل دفعة ومبلغها بدقة.',
    'reason.bankInfo': 'ليصلك أي استرداد إيداعًا مباشرًا في حسابك بدل شيك ورقي.',
    'reason.refundDeposit': 'ليصلك الاسترداد إيداعًا مباشرًا في حسابك.',

    'reason.crypto':
      'أجبت بنعم عن سؤال الأصول الرقمية العام الماضي. أرسل سجل المعاملات كاملًا من كل منصة ومحفظة.',
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
