/**
 * Russian. IRS Publication 17 language.
 *
 * Russian takes four plural forms and CLDR reports all four: `one` (1, 21, 101
 * — nominative singular), `few` (2–4, 22–24 — genitive singular), `many` (5–20,
 * 0 — genitive plural) and `other` (fractions). "3 документа" and "5 документов"
 * are both correct and neither is interchangeable; a product that ships one of
 * them for every count has been pasted through a machine, not translated.
 *
 * Every sentence below is deliberately framed so the counted noun sits in the
 * nominative/accusative — «ждём {n} {n#document}», «всего {n} {n#item}» — because
 * that is the frame CLDR's categories actually encode. Verbs that govern the
 * genitive («не хватает») would need a fifth form the categories cannot express,
 * so they are avoided rather than fudged.
 *
 * Cyrillic is outside GSM-7, so every Russian SMS is UCS-2 at 70 characters a
 * segment. The copy is short on purpose.
 */

import type { Dictionary } from '../types.ts';

export const ru: Dictionary = {
  locale: 'ru',
  review: 'machine',
  plural: {
    item: { one: 'пункт', few: 'пункта', many: 'пунктов', other: 'пункта' },
    document: { one: 'документ', few: 'документа', many: 'документов', other: 'документа' },
    day: { one: 'день', few: 'дня', many: 'дней', other: 'дня' },
  },
  chase: {
    warm: {
      subject: 'Список документов от {firmName} готов',
      body: [
        'Здравствуйте, {clientFirstName}!',
        'Мы составили список документов для декларации за этот год — по данным вашей прошлогодней декларации. Всего {totalCount} {totalCount#item}, и ничего лишнего в нём нет.',
        '{bullets}',
        'Загрузить можно прямо с телефона: фотографии подойдут, мы сами выровняем их и переименуем.',
        '{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}: {clientFirstName}, ждём {topList}. Загрузка за 2 минуты: {portalUrl}. STOP — отписаться.',
    },
    neutral: {
      subject: '{outstandingCount} {outstandingCount#document} для вашей декларации',
      body: ['Здравствуйте, {clientFirstName}!', '{lede}', '{bullets}', '{portalUrl}', '{signature}'],
      sms: '{firmName}: всё ещё ждём {topList}. {portalUrl}. STOP — отписаться.',
    },
    firm: {
      subject: 'Всё ещё нужны: {topList}',
      body: [
        'Здравствуйте, {clientFirstName}!',
        'Ждём уже {daysWaiting} {daysWaiting#day}. Мы не сможем начать вашу декларацию, пока не получим:',
        '{bullets}',
        'Если что-то из списка в этом году к вам не относится — напишите нам, и мы уберём этот пункт, а не будем спрашивать снова.',
        '{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}: ждём {daysWaiting} дн. — {topList}. Без этого не начать. {portalUrl}. STOP — отписаться.',
    },
    urgent: {
      subject: 'Декларация на паузе — ждём ещё {outstandingCount} {outstandingCount#item}',
      body: [
        '{clientFirstName},',
        'Осталось совсем немного, и с декларацией будет покончено. Мы ждём {outstandingCount} {outstandingCount#document}:',
        '{bullets}',
        '{deadline}',
        'Загрузите здесь — это займёт около двух минут:\n{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}: не хватает документов ({outstandingCount}), до срока {daysToDeadline} дн. {topList}. {portalUrl}. STOP — отписаться.',
    },
    final: {
      subject: 'Скорее всего продление — последнее напоминание о документах',
      body: [
        '{clientFirstName},',
        'Это наше последнее автоматическое напоминание. У нас до сих пор нет:',
        '{bullets}',
        'Если в ближайшие дни документы не придут, мы подадим за вас заявление о продлении срока и вернёмся к декларации позже. Продление даёт больше времени на подачу, но не на оплату, поэтому на остаток налога проценты начисляются с {deadlineDate}.',
        '{portalUrl}',
        'Если что-то мешает — ответьте на это письмо, и мы разберёмся напрямую.',
        '{signature}',
      ],
      sms: '{firmName}: последний раз. Без {topList} подадим на продление. {portalUrl}. STOP — отписаться.',
    },
  },
  s: {
    'list.fallback': 'несколько документов',
    'list.plus': ' и ещё {restCount}',
    'bullet.more': '  …и ещё {restCount}',
    'neutral.ledeSome':
      'Спасибо — {doneCount} из {totalCount} уже у нас. Ждём ещё {outstandingCount}:',
    'neutral.ledeNone': 'Мы всё ещё ждём {outstandingCount} {outstandingCount#item}:',
    'urgent.deadlineNear':
      'До срока подачи {daysToDeadline} {daysToDeadline#day}. После него придётся подавать на продление, а оно не переносит срок уплаты.',
    'urgent.deadlineFar': 'Чем дольше это тянется, тем вероятнее, что дело кончится продлением срока.',
    'item.fromIssuer': '{code} от {issuers}',

    'portal.title': 'Ваши документы для {firmName}',
    'portal.progress': 'Получено {receivedCount} из {totalCount}',
    'portal.needed': 'Ещё нужны',
    'portal.upload': 'Загрузить',
    'portal.uploadHint':
      'Фотография с телефона подойдёт — мы сами выровняем её и переименуем.',
    'portal.allDone': 'Это всё. Больше ничего присылать не нужно.',
    'portal.whyAsked': 'Зачем это нужно',
    'portal.help': 'Что-то не получается? Ответьте на любое наше письмо — вам ответит человек.',
    'portal.language': 'Язык',
    'portal.languageHint': 'Выберите язык, на котором мы будем вам писать.',
    'portal.loadFailed': 'Не удалось загрузить ваш список',
    'portal.loadFailedHint':
      'Проверьте соединение и обновите страницу. Всё, что вы прислали, на месте.',
    'portal.emptyTitle': 'Сейчас ничего не нужно',
    'portal.emptyHint': 'Как только {firmName} понадобится документ от вас, он появится здесь.',
    'portal.somethingElse': 'Что-то ещё?',

    'upload.gotItIssuer': 'Получили — {code} от {issuer}.',
    'upload.gotItCode': 'Получили — {code}.',
    'upload.gotItSaved': 'Получили — документ сохранён в вашем деле.',
    'upload.preparing': 'Подготовка',
    'upload.failed': 'Этот файл не загрузился.',
    'upload.unreadable': 'Не удалось разобрать этот снимок. Сфотографируйте, пожалуйста, почётче.',
    'upload.undo': 'Отменить',
    'upload.undoLabel': 'Отменить — удалить {name}',
    'upload.removing': 'Удаляем…',
    'upload.removingLabel': 'Удаляем {name}',

    'signin.working': 'Безопасный вход…',
    'signin.confirmTitle': 'Подтвердите вашу почту',
    'signin.confirmBody':
      'В этой ссылке не оказалось вашего адреса, поэтому его нужно ввести один раз — чтобы убедиться, что это вы. Укажите адрес, на который бухгалтер прислал ссылку: это единственное, что мы проверяем, пароль не нужен.',
    'signin.emailLabel': 'Адрес электронной почты',
    'signin.continue': 'Продолжить',
    'signin.expiredTitle': 'Пришлём вам новую ссылку',
    'signin.expiredBody':
      'Эта защищённая ссылка истекла или уже была использована. Мы можем прислать новую.',
    'signin.expiredShort': 'Эта защищённая ссылка истекла.',
    'signin.yourEmail': 'Ваш адрес электронной почты',
    'signin.sendLink': 'Пришлите мне новую ссылку',
    'signin.sentTitle': 'Проверьте почту',
    'signin.sentBody':
      'Мы отправили защищённую ссылку на {email}. Откройте её на этом же устройстве — и вы внутри, никаких паролей.',

    'status.pending': 'Нужен',
    'status.received': 'Получен',
    'status.accepted': 'Принят',
    'status.rejected': 'Нужна другая копия',
    'status.waived': 'Не требуется',
  },
  docCode: {
    'crypto-report': 'Криптоактивы',
    'profit-loss': 'Отчёт о прибылях',
    'balance-sheet': 'Баланс',
    'mileage-log': 'Журнал пробега',
    'asset-schedule': 'Покупка активов',
    'home-office': 'Домашний офис',
    'bank-statements': 'Банковские выписки',
    'payroll-summary': 'Годовая зарплата',
    'property-tax': 'Налог на недвижимость',
    'rental-summary': 'Аренда: доходы и расходы',
    'closing-statement': 'Документы по сделке',
    charitable: 'Квитанции о пожертвованиях',
    'medical-expenses': 'Медицинские расходы',
    childcare: 'Уход за детьми',
    'estimated-payments': 'Авансовые платежи',
    'k12-educator': 'Расходы учителя',
    'energy-credit': 'Энергоэффективность',
    'photo-id': 'Удостоверение личности',
    'ssn-card': 'Карта SSN',
    'voided-check': 'Банковские реквизиты',
    'prior-return': 'Прошлогодняя декларация',
    'engagement-letter': 'Договор об оказании услуг',
    organizer: 'Налоговая анкета',
    other: 'Другой документ',
  },
};
