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
    'portal.done': 'Tapos · {doneCount}',
    'portal.uploadedCount': '{uploadedCount} sa {expectedCount} ang na-upload',
    'portal.private': 'Pribado',
    'portal.needsAnotherTry': 'Kailangang ulitin: {detail}',
    'portal.yourAccountant': 'ang accountant ninyo',
    'portal.somethingElseHint':
      'May dokumento po ba kayong wala sa listahan? Idagdag ninyo rito at aayusin ito ng {firmName}.',

    'upload.percent': '{percent}%',
    'upload.tryAgain': 'Subukan ulit',
    'upload.remove': 'Alisin',
    'upload.cancel': 'Kanselahin',
    'upload.chooseFiles': 'Pumili mula sa mga file ninyo',
    'upload.dropPrompt': 'I-drag dito ang litrato o {format}, o',
    'upload.chooseFile': 'pumili ng file',
    'upload.unsupported':
      'Hindi po suportado ang ganoong file. Kumuha ng litrato, o mag-upload ng {format}.',
    'upload.empty': 'Mukhang walang laman ang file na iyon. Subukan ang iba.',
    'upload.tooLarge': 'Masyadong malaki ang file na iyon — {limit} lang ang limit.',
    'upload.photoTooLarge': 'Masyadong malaki ang litratong iyon — {limit} lang ang limit.',
    'upload.heicUnreadable':
      'Hindi mabasa ng device na ito ang litratong iyon. Kunan ulit, o mag-upload ng {format}.',
    'upload.heicFailed': 'Hindi namin naproseso ang litratong iyon. Subukan po ang {format}.',
  },
  reason: {
    'reason.engagement': 'Kailangan po ito bago kami makapagsimula.',
    'reason.photoId': 'Kailangan para ma-verify ang pagkakakilanlan ninyo kapag nag-e-file kami.',
    'reason.photoIdBoth':
      'Kailangan ng magkabilang asawa ng kasalukuyang photo ID para makapag-e-file.',
    'reason.ipPin':
      'Gumamit po kayo ng IRS Identity Protection PIN sa {year} na return ninyo. Bagong PIN ang inilalabas ng IRS tuwing Disyembre.',
    'reason.priorReturn':
      'Ipadala po ang buong return noong nakaraang taon at doon namin bubuuin nang kusa ang natitira sa listahang ito.',

    'reason.w2Issuers': 'Noong nakaraang taon may {count} {code} kayo — mula sa {issuers}.',
    'reason.w2IssuersMany': 'Noong nakaraang taon may {count} {code} kayo — mula sa {issuers}.',
    'reason.w2Wages': 'Sa {year} na return ninyo, {amount} ang naiulat na sahod.',
    'reason.w2Each': 'Isa mula sa bawat employer.',

    'reason.interestIssuers': 'May interes kayo noong nakaraang taon mula sa {issuers}.',
    'reason.interestAmount': 'Sa {year} na return ninyo, {amount} ang naiulat na kita sa interes.',
    'reason.dividendsIssuers': 'May dividends kayo noong nakaraang taon mula sa {issuers}.',
    'reason.dividendsAmount': 'Sa {year} na return ninyo, {amount} ang naiulat na dividends.',
    'reason.brokerIssuers':
      'Nag-file po kayo ng {code} noong nakaraang taon na may transaksyon sa {issuers}. Kailangan namin ang buong consolidated statement, kasama ang mga pahina ng cost basis.',
    'reason.brokerSchedule':
      'Nag-file kayo ng {code} noong nakaraang taon, kaya kailangan namin ang consolidated {code2} ng broker ninyo — pati ang detalye ng cost basis.',

    'reason.retirement':
      'Sa {year} na return ninyo, {amount} ang naiulat mula sa IRA, pensiyon o annuity.',
    'reason.socialSecurity': 'Nag-ulat po kayo ng {amount} na benepisyo sa Social Security noong nakaraang taon.',
    'reason.unemployment':
      'May naiulat na unemployment o state tax refund noong nakaraang taon.',

    'reason.scheduleCMany':
      'Nag-file po kayo ng {count} {code} noong nakaraang taon — isang profit & loss statement kada negosyo.',
    'reason.scheduleCIncome':
      'Nag-file kayo ng {code} noong nakaraang taon na may {amount} na net na kita sa negosyo. Ang buong-taong P&L ang pinakamabilis na paraan para matapos ito.',
    'reason.scheduleC':
      'Nag-file kayo ng {code} noong nakaraang taon. Ang buong-taong P&L ang pinakamabilis na paraan para matapos ito.',
    'reason.necIssuers': 'Nakatanggap po kayo ng {code} mula sa {issuers} noong nakaraang taon.',
    'reason.necSelfEmployed':
      'Nag-ulat po kayo ng kita bilang self-employed noong nakaraang taon — ipadala ang anumang {code} na matatanggap ninyo.',
    'reason.paymentAppIssuers':
      'Nakatanggap kayo ng {code} mula sa {issuers} noong nakaraang taon. Pababa nang pababa ang reporting threshold, kaya asahan po ninyong may isa pa.',
    'reason.paymentApp':
      'Nakatanggap kayo ng {code} noong nakaraang taon. Pababa nang pababa ang reporting threshold, kaya asahan po ninyong may isa pa.',
    'reason.mileage':
      'Nag-claim po kayo ng gastos sa sasakyan noong nakaraang taon. Hinihingi ng IRS ang mileage record na isinusulat habang nangyayari, kaya ipadala ang logbook o ang export mula sa app.',
    'reason.homeOffice':
      'Nag-claim kayo ng home office noong nakaraang taon — kailangan namin ang sukat ngayong taon, saka ang kuryente at tubig, upa o mortgage interest, at insurance.',
    'reason.assets':
      'Ipadala ang mga resibo ng anumang binili ng negosyo na lampas $2,500 — kagamitan, sasakyan, o pagpapaganda.',
    'reason.payroll':
      'Ang year-end payroll reports ({codes}) ang ginagamit para itugma ang sahod sa return.',
    'reason.bankStatements':
      'May kita po kayo sa negosyo noong nakaraang taon pero walang bookkeeping file. Sa labindalawang buwang statement, kami na ang gagawa ng P&L para sa inyo.',

    'reason.k1PartnershipIssuers':
      'May bahagi po kayo sa {issuers}. Madalas nahuhuli ang {code} ng partnership — ipadala ang bawat isa pagdating.',
    'reason.k1Partnership': 'Nakatanggap kayo ng {count} {code} ng partnership noong nakaraang taon.',
    'reason.k1PartnershipMany':
      'Nakatanggap kayo ng {count} {code} ng partnership noong nakaraang taon.',
    'reason.k1SCorpIssuers': 'Shareholder po kayo sa {issuers}.',
    'reason.k1SCorp': 'Nakatanggap kayo ng {count} {code} ng S corporation noong nakaraang taon.',
    'reason.k1SCorpMany': 'Nakatanggap kayo ng {count} {code} ng S corporation noong nakaraang taon.',
    'reason.k1Trust': 'Benepisyaryo po kayo ng trust o estate noong nakaraang taon.',

    'reason.rentalMany':
      'Ipinakita ng {code} na may {count} kayong paupahang ari-arian noong nakaraang taon — ipadala ang kita at gastos ng bawat isa.',
    'reason.rentalOne':
      'Nag-file kayo ng {code} noong nakaraang taon. Ipadala ang buong-taong upa na nakolekta pati ang mga gastos sa ari-arian.',
    'reason.mortgageIssuers': 'May binayarang mortgage interest kayo sa {issuers} noong nakaraang taon.',
    'reason.mortgage': 'Nag-deduct po kayo ng mortgage interest noong nakaraang taon.',
    'reason.propertyTax': 'Nag-deduct po kayo ng real estate tax noong nakaraang taon.',
    'reason.closing': 'Kung bumili, nagbenta, o nag-refinance lang kayo ng ari-arian ngayong taon.',

    'reason.charitableGave':
      'Nag-itemize po kayo noong nakaraang taon at nagbigay ng {amount}. Ang lampas $250 ay kailangan ng nakasulat na patunay mula sa charity.',
    'reason.charitable':
      'Nag-itemize po kayo noong nakaraang taon. Ang lampas $250 ay kailangan ng nakasulat na patunay mula sa charity.',
    'reason.medical': 'Nag-claim po kayo ng {amount} na gastusing medikal noong nakaraang taon.',
    'reason.studentLoan': 'Nag-deduct po kayo ng student loan interest noong nakaraang taon.',
    'reason.education': 'Nag-claim po kayo ng education credit noong nakaraang taon.',
    'reason.childcare':
      'Nag-claim po kayo ng child and dependent care credit noong nakaraang taon. Kailangan namin ang pangalan, address, at tax ID ng provider — hindi lang ang halaga.',
    'reason.ira': 'Nag-deduct po kayo ng IRA contribution noong nakaraang taon.',
    'reason.hsa': 'Nag-file po kayo ng Form {code} para sa HSA noong nakaraang taon.',
    'reason.hsaSpend': 'Kailangan kung may ginastos kayo mula sa HSA ngayong taon.',
    'reason.energy': 'Nag-claim po kayo ng home energy credit noong nakaraang taon.',
    'reason.educator': 'Nag-claim po kayo ng educator expense deduction noong nakaraang taon.',
    'reason.marketplace':
      'May Marketplace coverage po kayo noong nakaraang taon. Kapag walang Form {code}, tuwirang ibinabasura ng IRS ang return.',

    'reason.estimatesTotal':
      'Nagbayad po kayo ng estimated payments noong nakaraang taon na umabot sa {amount}. Kailangan namin ang eksaktong petsa at halaga ng bawat isa.',
    'reason.estimates':
      'Nagbayad po kayo ng estimated payments noong nakaraang taon. Kailangan namin ang eksaktong petsa at halaga ng bawat isa.',
    'reason.bankInfo':
      'Para dumiretso sa account ninyo ang anumang refund sa halip na papel na tseke.',
    'reason.refundDeposit': 'Para dumiretso sa account ninyo ang refund.',

    'reason.crypto':
      'Sumagot po kayo ng oo sa tanong tungkol sa digital assets noong nakaraang taon. Ipadala ang buong transaction export ng bawat exchange at wallet.',
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
