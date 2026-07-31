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
    'portal.done': 'Готово · {doneCount}',
    'portal.uploadedCount': 'Загружено {uploadedCount} из {expectedCount}',
    'portal.private': 'Конфиденциально',
    'portal.needsAnotherTry': 'Нужна ещё попытка: {detail}',
    'portal.yourAccountant': 'ваш бухгалтер',
    'portal.somethingElseHint':
      'Есть документ, которого нет в списке? Добавьте его здесь, и {firmName} разберётся.',

    'upload.percent': '{percent} %',
    'upload.tryAgain': 'Ещё раз',
    'upload.remove': 'Удалить',
    'upload.cancel': 'Отмена',
    'upload.chooseFiles': 'Выбрать из своих файлов',
    'upload.dropPrompt': 'Перетащите сюда фото или {format} — либо',
    'upload.chooseFile': 'выберите файл',
    'upload.unsupported': 'Такой файл не подходит. Сфотографируйте документ или загрузите {format}.',
    'upload.empty': 'Файл выглядит пустым. Попробуйте другой.',
    'upload.tooLarge': 'Файл слишком большой — предел {limit}.',
    'upload.photoTooLarge': 'Фото слишком большое — предел {limit}.',
    'upload.heicUnreadable':
      'На этом устройстве фото не читается. Сфотографируйте ещё раз или загрузите {format}.',
    'upload.heicFailed': 'Не удалось обработать это фото. Попробуйте {format}.',
  },
  reason: {
    'reason.engagement': 'Без этого мы не можем начать работу.',
    'reason.photoId': 'Нужно, чтобы подтвердить вашу личность при электронной подаче.',
    'reason.photoIdBoth':
      'Для электронной подачи действующее удостоверение с фото нужно обоим супругам.',
    'reason.ipPin':
      'В декларации за {year} год вы использовали PIN-код защиты личности IRS. IRS выдаёт новый каждый декабрь.',
    'reason.priorReturn':
      'Пришлите полную прошлогоднюю декларацию — по ней мы автоматически соберём остальной список.',

    'reason.w2Issuers': 'В прошлом году у вас было {count} {code} — от {issuers}.',
    'reason.w2IssuersMany': 'В прошлом году у вас было {count} {code} — от {issuers}.',
    'reason.w2Wages': 'В декларации за {year} год указана зарплата {amount}.',
    'reason.w2Each': 'По одной от каждого работодателя.',

    'reason.interestIssuers': 'В прошлом году проценты приходили от {issuers}.',
    'reason.interestAmount':
      'В декларации за {year} год указан процентный доход {amount}.',
    'reason.dividendsIssuers': 'В прошлом году дивиденды приходили от {issuers}.',
    'reason.dividendsAmount': 'В декларации за {year} год указаны дивиденды {amount}.',
    'reason.brokerIssuers':
      'В прошлом году вы подавали {code}, операции проходили в {issuers}. Нужна полная сводная выписка, включая страницы с себестоимостью.',
    'reason.brokerSchedule':
      'В прошлом году вы подавали {code}, поэтому нужна сводная {code2} от вашего брокера — вместе с расшифровкой себестоимости.',

    'reason.retirement':
      'В декларации за {year} год указано {amount} из IRA, пенсии или аннуитета.',
    'reason.socialSecurity':
      'В прошлом году вы указали {amount} выплат по социальному обеспечению.',
    'reason.unemployment':
      'В прошлом году были указаны пособие по безработице или возврат налога штата.',

    'reason.scheduleCMany':
      'В прошлом году вы подали {count} {code} — по одному отчёту о прибылях и убытках на каждый бизнес.',
    'reason.scheduleCIncome':
      'В прошлом году вы подали {code} с чистым доходом от бизнеса {amount}. Отчёт о прибылях и убытках за весь год — самый быстрый путь.',
    'reason.scheduleC':
      'В прошлом году вы подали {code}. Отчёт о прибылях и убытках за весь год — самый быстрый путь.',
    'reason.necIssuers': 'В прошлом году вы получали {code} от {issuers}.',
    'reason.necSelfEmployed':
      'В прошлом году вы указали доход от самозанятости — присылайте любые {code}, которые придут.',
    'reason.paymentAppIssuers':
      'В прошлом году вы получили {code} от {issuers}. Порог отчётности всё снижается, так что ждите ещё один.',
    'reason.paymentApp':
      'В прошлом году вы получили {code}. Порог отчётности всё снижается, так что ждите ещё один.',
    'reason.mileage':
      'В прошлом году вы списывали расходы на автомобиль. IRS требует журнал пробега, который вёлся по ходу дела, — пришлите журнал или выгрузку из приложения.',
    'reason.homeOffice':
      'В прошлом году вы заявляли домашний офис — нужны площадь за этот год, а также коммунальные платежи, аренда или проценты по ипотеке и страховка.',
    'reason.assets':
      'Пришлите счета на всё, что бизнес купил дороже $2,500 — оборудование, транспорт, улучшения.',
    'reason.payroll':
      'Годовые зарплатные отчёты ({codes}) сверяют зарплату, указанную в декларации.',
    'reason.bankStatements':
      'В прошлом году доход от бизнеса был, а файла бухгалтерии нет. По двенадцати месяцам выписок мы соберём отчёт о прибылях и убытках за вас.',

    'reason.k1PartnershipIssuers':
      'У вас есть доли в {issuers}. {code} от партнёрств часто приходят поздно — присылайте каждую по мере получения.',
    'reason.k1Partnership': 'В прошлом году вы получили {count} {code} от партнёрства.',
    'reason.k1PartnershipMany': 'В прошлом году вы получили {count} {code} от партнёрств.',
    'reason.k1SCorpIssuers': 'Вы акционер в {issuers}.',
    'reason.k1SCorp': 'В прошлом году вы получили {count} {code} от S-корпорации.',
    'reason.k1SCorpMany': 'В прошлом году вы получили {count} {code} от S-корпораций.',
    'reason.k1Trust': 'В прошлом году вы были выгодоприобретателем траста или наследства.',

    'reason.rentalMany':
      'В {code} за прошлый год показано {count} объекта в аренде — пришлите доходы и расходы по каждому.',
    'reason.rentalOne':
      'В прошлом году вы подали {code}. Пришлите годовую сумму собранной аренды и расходы по объекту.',
    'reason.mortgageIssuers': 'В прошлом году проценты по ипотеке шли в {issuers}.',
    'reason.mortgage': 'В прошлом году вы списывали проценты по ипотеке.',
    'reason.propertyTax': 'В прошлом году вы списывали налог на недвижимость.',
    'reason.closing': 'Только если в этом году вы покупали, продавали или рефинансировали недвижимость.',

    'reason.charitableGave':
      'В прошлом году вы применяли постатейные вычеты и пожертвовали {amount}. На всё свыше $250 нужна письменная квитанция от благотворительной организации.',
    'reason.charitable':
      'В прошлом году вы применяли постатейные вычеты. На всё свыше $250 нужна письменная квитанция от благотворительной организации.',
    'reason.medical': 'В прошлом году вы заявили {amount} медицинских расходов.',
    'reason.studentLoan': 'В прошлом году вы списывали проценты по студенческому кредиту.',
    'reason.education': 'В прошлом году вы заявляли образовательный вычет.',
    'reason.childcare':
      'В прошлом году вы заявляли вычет за уход за детьми и иждивенцами. Нужны название, адрес и налоговый номер поставщика услуг — не только сумма.',
    'reason.ira': 'В прошлом году вы списывали взнос в IRA.',
    'reason.hsa': 'В прошлом году вы подали форму {code} по счёту HSA.',
    'reason.hsaSpend': 'Понадобится, если в этом году вы тратили со счёта HSA.',
    'reason.energy': 'В прошлом году вы заявляли вычет за энергоэффективность жилья.',
    'reason.educator': 'В прошлом году вы заявляли вычет расходов педагога.',
    'reason.marketplace':
      'В прошлом году у вас была страховка с Marketplace. Без формы {code} IRS отклоняет декларацию сразу.',

    'reason.estimatesTotal':
      'В прошлом году вы вносили авансовые платежи на общую сумму {amount}. Нужны точная дата и сумма каждого.',
    'reason.estimates':
      'В прошлом году вы вносили авансовые платежи. Нужны точная дата и сумма каждого.',
    'reason.bankInfo': 'Чтобы возврат пришёл прямо на счёт, а не бумажным чеком.',
    'reason.refundDeposit': 'Чтобы возврат пришёл прямо на счёт.',

    'reason.crypto':
      'В прошлом году вы ответили «да» на вопрос о цифровых активах. Пришлите полную выгрузку операций с каждой биржи и каждого кошелька.',
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
