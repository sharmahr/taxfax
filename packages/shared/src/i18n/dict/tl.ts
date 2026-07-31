/**
 * Tagalog. Carried for population coverage; Schedule LEP code 007.
 *
 * CLDR files the language as Filipino, so `Intl` is given `fil` while the locale
 * id stays `tl` (which is what `lang="tl"` and the LEP form both use).
 *
 * Register is the everyday professional Taglish that Filipino-American
 * correspondence actually uses: English tax terms are left in English because
 * that is what people say and what is printed on the forms — "W-2", "extension",
 * "deadline" — while the sentence around them is Tagalog. Purist Tagalog for
 * "extension" would be less clear, not more.
 */

import type { Dictionary } from '../types.ts';

export const tl: Dictionary = {
  locale: 'tl',
  review: 'machine',
  plural: {
    // Tagalog marks plurality with "mga", not by inflecting the noun.
    item: { one: 'dokumento', other: 'dokumento' },
    document: { one: 'dokumento', other: 'dokumento' },
    day: { one: 'araw', other: 'araw' },
  },
  chase: {
    warm: {
      subject: 'Handa na ang listahan ng dokumento ninyo para sa {firmName}',
      body: [
        'Kumusta {clientFirstName},',
        'Nagawa na namin ang listahan ng dokumento para sa tax return ninyo ngayong taon. {totalCount} {totalCount#item} lahat, kinuha sa return ninyo noong nakaraang taon, kaya walang naroon na hindi ninyo talaga kailangan.',
        '{bullets}',
        'Puwede ninyong i-upload diretso mula sa telepono. Okay lang ang litrato — kami na ang bahalang ituwid at palitan ang pangalan ng file.',
        '{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}: {clientFirstName}, kailangan pa ang {topList}. I-upload: {portalUrl} — STOP para tumigil.',
    },
    neutral: {
      subject: '{outstandingCount} {outstandingCount#document} pa ang kulang sa tax return ninyo',
      body: ['Kumusta {clientFirstName},', '{lede}', '{bullets}', '{portalUrl}', '{signature}'],
      sms: '{firmName}: hinihintay pa ang {topList}. {portalUrl} — STOP para tumigil.',
    },
    firm: {
      subject: 'Kailangan pa: {topList}',
      body: [
        'Kumusta {clientFirstName},',
        '{daysWaiting} {daysWaiting#day} na po. Hindi namin masisimulan ang return ninyo hangga\'t hindi dumarating ang mga ito:',
        '{bullets}',
        'Kung may nasa listahan na hindi na po ninyo kailangan ngayong taon, i-reply lang ninyo — aalisin namin sa halip na paulit-ulit na hingin.',
        '{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}: {daysWaiting} araw nang hinihintay ang {topList}. Hindi pa masisimulan. {portalUrl} — STOP.',
    },
    urgent: {
      subject: 'Naka-hold ang return ninyo — kulang ng {outstandingCount} {outstandingCount#item}',
      body: [
        '{clientFirstName},',
        'Ito na lang ang natitira bago matapos ang return ninyo, at hinihintay pa namin ang {outstandingCount} {outstandingCount#document}:',
        '{bullets}',
        '{deadline}',
        'I-upload dito — mga dalawang minuto lang:\n{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}: kulang ng {outstandingCount} dokumento, {daysToDeadline} araw na lang. {topList}. {portalUrl} — STOP.',
    },
    final: {
      subject: 'Malamang mag-extension — huling paalala para sa mga dokumento ninyo',
      body: [
        '{clientFirstName},',
        'Ito na po ang huli naming awtomatikong paalala. Wala pa rin sa amin ang:',
        '{bullets}',
        'Kapag hindi ito dumating sa susunod na ilang araw, mag-file na lang kami ng extension para sa inyo at babalikan namin ito pagkatapos. Ang extension ay nagbibigay ng dagdag na panahon para mag-file, hindi para magbayad, kaya patuloy pa ring tutubo ang interes sa anumang babayaran simula {deadlineDate}.',
        '{portalUrl}',
        'Kung may dahilan kung bakit natigil, i-reply lang ninyo ang email na ito at tutulungan namin kayo nang diretso.',
        '{signature}',
      ],
      sms: '{firmName}: huling paalala. Kung wala ang {topList}, mag-e-extension kami. {portalUrl} — STOP.',
    },
  },
  s: {
    'list.fallback': 'ilang dokumento',
    'list.plus': ', at {restCount} pa',
    'bullet.more': '  …at {restCount} pa',
    'neutral.ledeSome':
      'Salamat po — nasa amin na ang {doneCount} sa {totalCount}. Hinihintay pa namin ang {outstandingCount}:',
    'neutral.ledeNone': 'Hinihintay pa namin ang lahat ng {outstandingCount} {outstandingCount#item}:',
    'urgent.deadlineNear':
      '{daysToDeadline} araw na lang bago ang deadline ng pag-file. Pagkatapos noon, kailangan na naming mag-file ng extension, at hindi naman nito inililipat ang huling araw ng pagbabayad.',
    'urgent.deadlineFar': 'Habang tumatagal, mas malaki ang tsansang mauwi ito sa extension.',
    'item.fromIssuer': '{code} mula sa {issuers}',

    'portal.title': 'Mga dokumento ninyo para sa {firmName}',
    'portal.progress': '{receivedCount} sa {totalCount} ang natanggap',
    'portal.needed': 'Kailangan pa',
    'portal.upload': 'I-upload',
    'portal.uploadHint':
      'Okay lang ang litrato mula sa telepono — kami na ang bahalang ituwid at palitan ang pangalan.',
    'portal.allDone': 'Iyon na po ang lahat. Wala nang kailangang ipadala.',
    'portal.whyAsked': 'Bakit kailangan ito',
    'portal.help': 'May problema? I-reply lang ang alinman sa mga email namin at may sasagot sa inyo.',
    'portal.language': 'Wika',
    'portal.languageHint': 'Palitan ang wikang ginagamit namin kapag sumusulat sa inyo.',
    'portal.loadFailed': 'Hindi ma-load ang listahan ninyo',
    'portal.loadFailedHint':
      'Pakisuri ang koneksyon at i-reload ang page. Buo pa rin ang lahat ng naipadala ninyo.',
    'portal.emptyTitle': 'Wala pong kailangan sa ngayon',
    'portal.emptyHint': 'Kapag may kailangang dokumento ang {firmName} mula sa inyo, lalabas ito rito.',
    'portal.somethingElse': 'May iba pa po ba?',

    'upload.gotItIssuer': 'Nakuha na — {code} mula sa {issuer}.',
    'upload.gotItCode': 'Nakuha na — {code}.',
    'upload.gotItSaved': 'Nakuha na — nai-save na po sa file ninyo.',
    'upload.preparing': 'Inihahanda',
    'upload.failed': 'Hindi natuloy ang pag-upload na iyon.',
    'upload.unreadable': 'Hindi po namin mabasa iyon. Subukan ninyo ng mas malinaw na litrato.',
    'upload.undo': 'I-undo',
    'upload.undoLabel': 'I-undo — alisin ang {name}',
    'upload.removing': 'Inaalis…',
    'upload.removingLabel': 'Inaalis ang {name}',

    'signin.working': 'Ligtas kayong pinapasok…',
    'signin.confirmTitle': 'Kumpirmahin ang email ninyo',
    'signin.confirmBody':
      'Hindi kasama ang email ninyo sa link na ito, kaya kailangan namin ito nang minsan para makumpirmang kayo nga. Ilagay ang address na pinagpadalhan ng accountant ninyo — iyon lang po ang tinitingnan namin, walang password.',
    'signin.emailLabel': 'Email address',
    'signin.continue': 'Magpatuloy',
    'signin.expiredTitle': 'Padadalhan namin kayo ng bagong link',
    'signin.expiredBody':
      'Expired na o nagamit na ang ligtas na link na ito. Makakapagpadala po kami ng bago.',
    'signin.expiredShort': 'Expired na ang ligtas na link na ito.',
    'signin.yourEmail': 'Email address ninyo',
    'signin.sendLink': 'Padalhan ako ng bagong link',
    'signin.sentTitle': 'Tingnan ang email ninyo',
    'signin.sentBody':
      'Nagpadala kami ng ligtas na link sa {email}. Buksan ninyo ito sa device na ito at pasok na kayo — walang password na kailangang tandaan.',

    'status.pending': 'Kailangan',
    'status.received': 'Natanggap',
    'status.accepted': 'Tanggap na',
    'status.rejected': 'Kailangan ng ibang kopya',
    'status.waived': 'Hindi na kailangan',
  },
  docCode: {
    'crypto-report': 'Crypto',
    'profit-loss': 'Profit and loss',
    'balance-sheet': 'Balance sheet',
    'mileage-log': 'Talaan ng mileage',
    'asset-schedule': 'Mga biniling asset',
    'home-office': 'Home office',
    'bank-statements': 'Bank statement',
    'payroll-summary': 'Buod ng payroll',
    'property-tax': 'Property tax',
    'rental-summary': 'Kita at gastos sa paupahan',
    'closing-statement': 'Closing statement',
    charitable: 'Resibo ng donasyon',
    'medical-expenses': 'Gastos sa gamutan',
    childcare: 'Gastos sa pag-aalaga ng bata',
    'estimated-payments': 'Estimated na bayad',
    'k12-educator': 'Gastos ng guro',
    'energy-credit': 'Resibo sa energy improvement',
    'photo-id': 'ID',
    'ssn-card': 'Social Security card',
    'voided-check': 'Detalye ng bangko',
    'prior-return': 'Return noong nakaraang taon',
    'engagement-letter': 'Engagement letter',
    organizer: 'Tax organizer',
    other: 'Ibang dokumento',
  },
};
