/**
 * Haitian Creole. Covered by the IRS for web resources and carried here for the
 * Miami-Dade, Broward and Brooklyn filing populations.
 *
 * Known platform gap: Node's ICU has no `ht` data and silently resolves it to an
 * English locale. Two consequences, both handled or declared:
 *   • Lists — the locale record carries `conjunction: 'ak'`, so `formatList`
 *     bypasses `Intl.ListFormat` here rather than emitting "and".
 *   • Dates — `{deadlineDate}` renders with English month names ("15 April"
 *     rather than "15 avril"). Not fixable without shipping month names by hand,
 *     which is not worth a dictionary entry for one string; flagged in the report.
 */

import type { Dictionary } from '../types.ts';

export const ht: Dictionary = {
  locale: 'ht',
  review: 'machine',
  plural: {
    // Haitian Creole does not inflect the noun for number.
    item: { one: 'dokiman', other: 'dokiman' },
    document: { one: 'dokiman', other: 'dokiman' },
    day: { one: 'jou', other: 'jou' },
  },
  chase: {
    warm: {
      subject: 'Lis dokiman ou pou {firmName} pare',
      body: [
        'Bonjou {clientFirstName},',
        'Nou fin prepare lis dokiman ou bezwen pou deklarasyon taks ane sa a. Li gen {totalCount} {totalCount#item}, epi nou tire yo nan deklarasyon ou te fè ane pase a — donk pa gen anyen sou li ou pa reyèlman bezwen.',
        '{bullets}',
        'Ou ka voye yo dirèkteman ak telefòn ou. Foto se korèk — se nou k ap drese yo epi chanje non yo.',
        '{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}: {clientFirstName}, nou bezwen {topList}. Voye yo: {portalUrl} — STOP pou sispann.',
    },
    neutral: {
      subject: 'Gen {outstandingCount} {outstandingCount#document} ki rete pou deklarasyon ou',
      body: ['Bonjou {clientFirstName},', '{lede}', '{bullets}', '{portalUrl}', '{signature}'],
      sms: '{firmName}: n ap tann {topList}. {portalUrl} — STOP pou sispann.',
    },
    firm: {
      subject: 'Nou toujou bezwen: {topList}',
      body: [
        'Bonjou {clientFirstName},',
        'Sa fè {daysWaiting} {daysWaiting#day}. Nou pa ka kòmanse deklarasyon ou toutotan bagay sa yo pa rive:',
        '{bullets}',
        'Si gen yon bagay sou lis la ki pa konsène ou ane sa a, reponn epi di nou — n ap retire l olye n ap kontinye mande ou li.',
        '{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}: {daysWaiting} jou n ap tann {topList}. Nou pa ka kòmanse. {portalUrl} — STOP.',
    },
    urgent: {
      subject: 'Deklarasyon ou an pòz — {outstandingCount} {outstandingCount#item} ki manke',
      body: [
        '{clientFirstName},',
        'Se sèl bagay sa a ki rete pou deklarasyon ou fini, epi n ap tann {outstandingCount} {outstandingCount#document}:',
        '{bullets}',
        '{deadline}',
        'Voye yo isit la — sa pran de minit:\n{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}: {outstandingCount} dokiman manke, {daysToDeadline} jou ki rete. {topList}. {portalUrl} — STOP.',
    },
    final: {
      subject: 'Nou ka oblije mande yon delè — dènye rapèl pou dokiman ou yo',
      body: [
        '{clientFirstName},',
        'Se dènye rapèl otomatik nou. Nou poko gen:',
        '{bullets}',
        'Si yo pa rive nan de twa jou k ap vini yo, n ap mande yon delè pou ou epi n ap reprann sa apre. Yon delè ba ou plis tan pou depoze deklarasyon an, men pa plis tan pou peye — donk tout balans ou dwe ap kontinye pran enterè depi {deadlineDate}.',
        '{portalUrl}',
        'Si gen yon rezon ki bloke ou, reponn imel sa a epi n ap regle sa dirèkteman.',
        '{signature}',
      ],
      sms: '{firmName}: dènye rapèl. San {topList} n ap mande yon delè. {portalUrl} — STOP.',
    },
  },
  s: {
    'list.fallback': 'kèk dokiman',
    'list.plus': ', ak {restCount} lòt',
    'bullet.more': '  …ak {restCount} lòt',
    'neutral.ledeSome':
      'Mèsi — nou resevwa {doneCount} sou {totalCount}. N ap tann {outstandingCount} ankò:',
    'neutral.ledeNone': 'Nou poko resevwa okenn nan {outstandingCount} {outstandingCount#item} yo:',
    'urgent.deadlineNear':
      'Gen {daysToDeadline} jou anvan dat limit la. Apre sa n ap oblije mande yon delè, epi yon delè pa ba ou plis tan pou peye.',
    'urgent.deadlineFar': 'Plis sa trennen, plis chans nou fini ak yon demann delè.',
    'item.fromIssuer': '{code} nan men {issuers}',

    'portal.title': 'Dokiman ou yo pou {firmName}',
    'portal.progress': '{receivedCount} sou {totalCount} resevwa',
    'portal.needed': 'Toujou bezwen',
    'portal.upload': 'Voye',
    'portal.uploadHint': 'Yon foto ak telefòn ou se korèk — se nou k ap drese l epi chanje non l.',
    'portal.allDone': 'Se tout. Pa gen anyen ankò pou voye.',
    'portal.whyAsked': 'Poukisa nou bezwen sa',
    'portal.help': 'Ou bloke? Reponn nenpòt imel nou voye epi yon moun ap reponn ou.',
    'portal.language': 'Lang',
    'portal.languageHint': 'Chanje lang nou itilize lè n ap ekri ou.',
    'portal.loadFailed': 'Nou pa t ka chaje lis ou a',
    'portal.loadFailedHint':
      'Tcheke koneksyon ou epi chaje paj la ankò. Anyen nan sa ou voye pa pèdi.',
    'portal.emptyTitle': 'Pa gen anyen ki nesèsè kounye a',
    'portal.emptyHint': 'Lè {firmName} bezwen yon dokiman nan men w, l ap parèt isit la.',
    'portal.somethingElse': 'Gen lòt bagay?',

    'upload.gotItIssuer': 'Nou resevwa l — {code} soti nan {issuer}.',
    'upload.gotItCode': 'Nou resevwa l — {code}.',
    'upload.gotItSaved': 'Nou resevwa l — nou sere l nan dosye w.',
    'upload.preparing': 'N ap prepare',
    'upload.failed': 'Sa a pa t rive monte.',
    'upload.unreadable': 'Nou pa t ka li sa a. Pran yon foto ki pi klè.',
    'upload.undo': 'Defè',
    'upload.undoLabel': 'Defè — retire {name}',
    'upload.removing': 'N ap retire…',
    'upload.removingLabel': 'N ap retire {name}',

    'signin.working': 'N ap konekte w an sekirite…',
    'signin.confirmTitle': 'Konfime imel ou',
    'signin.confirmBody':
      'Lyen sa a pa t pote imel ou, kidonk nou bezwen l yon sèl fwa pou nou konnen se ou menm. Mete adès kote kontab ou a te voye l la — se sèl bagay nou tcheke, pa gen modpas.',
    'signin.emailLabel': 'Adès imel',
    'signin.continue': 'Kontinye',
    'signin.expiredTitle': 'Ann voye yon nouvo lyen ba ou',
    'signin.expiredBody':
      'Lyen sekirize sa a fini oswa yo deja itilize l. Nou ka voye yon lòt ba ou.',
    'signin.expiredShort': 'Lyen sekirize sa a fini.',
    'signin.yourEmail': 'Adès imel ou',
    'signin.sendLink': 'Voye yon nouvo lyen ban mwen',
    'signin.sentTitle': 'Tcheke imel ou',
    'signin.sentBody':
      'Nou voye yon lyen sekirize nan {email}. Louvri l sou aparèy sa a epi ou antre — pa gen modpas pou sonje.',

    'status.pending': 'Bezwen',
    'status.received': 'Resevwa',
    'status.accepted': 'Aksepte',
    'status.rejected': 'Bezwen yon lòt kopi',
    'status.waived': 'Pa nesesè',
    'portal.done': 'Fini · {doneCount}',
    'portal.uploadedCount': '{uploadedCount} sou {expectedCount} voye',
    'portal.private': 'Prive',
    'portal.needsAnotherTry': 'Bezwen yon lòt esè: {detail}',
    'portal.yourAccountant': 'kontab ou a',
    'portal.somethingElseHint':
      'Ou gen yon dokiman ki pa sou lis la? Mete l isit la epi {firmName} ap regle l.',

    'upload.percent': '{percent}%',
    'upload.tryAgain': 'Eseye ankò',
    'upload.remove': 'Retire',
    'upload.cancel': 'Anile',
    'upload.chooseFiles': 'Chwazi nan fichye ou yo',
    'upload.dropPrompt': 'Rale yon foto oswa yon {format} isit la, oswa',
    'upload.chooseFile': 'chwazi yon fichye',
    'upload.unsupported': 'Kalite fichye sa a pa mache. Pran yon foto, oswa voye yon {format}.',
    'upload.empty': 'Fichye sa a sanble vid. Eseye yon lòt.',
    'upload.tooLarge': 'Fichye sa a twò gwo — limit la se {limit}.',
    'upload.photoTooLarge': 'Foto sa a twò gwo — limit la se {limit}.',
    'upload.heicUnreadable':
      'Aparèy sa a pa t ka li foto a. Repran l, oswa voye yon {format}.',
    'upload.heicFailed': 'Nou pa t ka trete foto sa a. Eseye yon {format} pito.',
  },
  reason: {
    'reason.engagement': 'Nou bezwen sa anvan nou ka kòmanse travay.',
    'reason.photoId': 'Nou bezwen l pou verifye idantite ou lè n ap voye deklarasyon an sou entènèt.',
    'reason.photoIdBoth':
      'Toude marye yo bezwen yon pyès idantite ak foto ki poko ekspire pou nou ka voye deklarasyon an sou entènèt.',
    'reason.ipPin':
      'Ou te sèvi ak yon PIN Pwoteksyon Idantite IRS sou deklarasyon {year} ou a. IRS bay yon nouvo chak mwa desanm.',
    'reason.priorReturn':
      'Voye tout deklarasyon ane pase a epi n ap monte rès lis sa a otomatikman ak li.',

    'reason.w2Issuers': 'Ane pase ou te gen {count} {code} — nan men {issuers}.',
    'reason.w2IssuersMany': 'Ane pase ou te gen {count} {code} — nan men {issuers}.',
    'reason.w2Wages': 'Deklarasyon {year} ou a te deklare {amount} salè.',
    'reason.w2Each': 'Youn pou chak anplwayè.',

    'reason.interestIssuers': 'Ane pase ou te fè enterè nan {issuers}.',
    'reason.interestAmount': 'Deklarasyon {year} ou a te deklare {amount} revni enterè.',
    'reason.dividendsIssuers': 'Ane pase ou te fè dividann nan {issuers}.',
    'reason.dividendsAmount': 'Deklarasyon {year} ou a te deklare {amount} dividann.',
    'reason.brokerIssuers':
      'Ane pase ou te ranpli {code} ak aktivite nan {issuers}. Nou bezwen tout deklarasyon konsolide a, ansanm ak paj pri revyen yo.',
    'reason.brokerSchedule':
      'Ane pase ou te ranpli {code}, kidonk nou bezwen {code2} konsolide kourtye ou a — ak detay pri revyen an.',

    'reason.retirement':
      'Deklarasyon {year} ou a te deklare {amount} ki soti nan yon IRA, yon pansyon oswa yon anwite.',
    'reason.socialSecurity': 'Ane pase ou te deklare {amount} nan benefis Sekirite Sosyal.',
    'reason.unemployment': 'Ane pase te gen chomaj oswa yon ranbousman taks eta ki te deklare.',

    'reason.scheduleCMany':
      'Ane pase ou te ranpli {count} {code} — yon eta pwofi ak pèt pou chak biznis.',
    'reason.scheduleCIncome':
      'Ane pase ou te ranpli {code} ak {amount} revni nèt biznis. Yon eta pwofi ak pèt pou tout ane a se chemen ki pi rapid la.',
    'reason.scheduleC':
      'Ane pase ou te ranpli {code}. Yon eta pwofi ak pèt pou tout ane a se chemen ki pi rapid la.',
    'reason.necIssuers': 'Ane pase ou te resevwa {code} nan men {issuers}.',
    'reason.necSelfEmployed':
      'Ane pase ou te deklare revni travay pou tèt ou — voye tout {code} ou resevwa.',
    'reason.paymentAppIssuers':
      'Ane pase ou te resevwa yon {code} nan men {issuers}. Limit deklarasyon an ap desann chak ane, kidonk ap gen yon lòt.',
    'reason.paymentApp':
      'Ane pase ou te resevwa yon {code}. Limit deklarasyon an ap desann chak ane, kidonk ap gen yon lòt.',
    'reason.mileage':
      'Ane pase ou te reklame depans machin. IRS mande yon rejis kilomèt ou te kenbe sou plas, kidonk voye kaye ou a oswa sa aplikasyon an bay.',
    'reason.homeOffice':
      'Ane pase ou te reklame yon biwo lakay — nou bezwen dimansyon ane sa a plis sèvis piblik, lwaye oswa enterè ipotèk, ak asirans.',
    'reason.assets':
      'Voye fakti pou tout sa biznis la achte ki pase $2,500 — ekipman, machin, oswa amelyorasyon.',
    'reason.payroll':
      'Rapò pewòl fen ane yo ({codes}) sèvi pou rekonsilye salè ki sou deklarasyon an.',
    'reason.bankStatements':
      'Ane pase ou te gen revni biznis men pa gen okenn fichye kontablite. Douz mwa releve bank ase pou nou monte eta pwofi ak pèt la pou ou.',

    'reason.k1PartnershipIssuers':
      'Ou gen enterè nan {issuers}. {code} patenarya yo souvan rive an reta — voye chak youn depi l rive.',
    'reason.k1Partnership': 'Ane pase ou te resevwa {count} {code} patenarya.',
    'reason.k1PartnershipMany': 'Ane pase ou te resevwa {count} {code} patenarya.',
    'reason.k1SCorpIssuers': 'Ou se aksyonè nan {issuers}.',
    'reason.k1SCorp': 'Ane pase ou te resevwa {count} {code} sosyete S.',
    'reason.k1SCorpMany': 'Ane pase ou te resevwa {count} {code} sosyete S.',
    'reason.k1Trust': 'Ane pase ou te benefisyè yon fidisi oswa yon eritaj.',

    'reason.rentalMany':
      '{code} te montre {count} pwopriyete an lokasyon ane pase — voye revni ak depans pou chak.',
    'reason.rentalOne':
      'Ane pase ou te ranpli {code}. Voye tout lwaye ou kolekte pou ane a plis depans pwopriyete a.',
    'reason.mortgageIssuers': 'Ane pase ou te peye enterè ipotèk bay {issuers}.',
    'reason.mortgage': 'Ane pase ou te dedwi enterè ipotèk.',
    'reason.propertyTax': 'Ane pase ou te dedwi taks sou pwopriyete.',
    'reason.closing': 'Sèlman si ou achte, vann oswa refinanse yon pwopriyete ane sa a.',

    'reason.charitableGave':
      'Ane pase ou te detaye dediksyon ou yo epi ou te bay {amount}. Tout sa ki pase $250 bezwen yon resi alekri nan men òganizasyon an.',
    'reason.charitable':
      'Ane pase ou te detaye dediksyon ou yo. Tout sa ki pase $250 bezwen yon resi alekri nan men òganizasyon an.',
    'reason.medical': 'Ane pase ou te reklame {amount} depans medikal.',
    'reason.studentLoan': 'Ane pase ou te dedwi enterè prè etidyan.',
    'reason.education': 'Ane pase ou te reklame yon kredi edikasyon.',
    'reason.childcare':
      'Ane pase ou te reklame kredi pou gadri timoun ak depandan. Nou bezwen non, adrès ak nimewo taks moun ki bay sèvis la — pa sèlman montan an.',
    'reason.ira': 'Ane pase ou te dedwi yon kontribisyon IRA.',
    'reason.hsa': 'Ane pase ou te ranpli Fòm {code} pou yon HSA.',
    'reason.hsaSpend': 'Nou bezwen l si ou depanse nan HSA ou ane sa a.',
    'reason.energy': 'Ane pase ou te reklame yon kredi enèji pou kay la.',
    'reason.educator': 'Ane pase ou te reklame dediksyon depans anseyan.',
    'reason.marketplace':
      'Ane pase ou te gen kouvèti Marketplace. San Fòm {code} IRS voye deklarasyon an tounen nèt.',

    'reason.estimatesTotal':
      'Ane pase ou te fè peman estime ki fè {amount} antou. Nou bezwen dat ak montan egzak chak peman.',
    'reason.estimates':
      'Ane pase ou te fè peman estime. Nou bezwen dat ak montan egzak chak peman.',
    'reason.bankInfo':
      'Konsa nenpòt ranbousman rive dirèk nan kont ou olye pou l vin yon chèk papye.',
    'reason.refundDeposit': 'Konsa yon ranbousman rive dirèk nan kont ou.',

    'reason.crypto':
      'Ane pase ou te reponn wi sou kesyon aktif dijital yo. Voye tout istorik tranzaksyon chak platfòm ak chak bous.',
  },
  docCode: {
    'crypto-report': 'Kripto',
    'profit-loss': 'Rapò pwofi ak pèt',
    'balance-sheet': 'Bilan',
    'mileage-log': 'Kanè kilomèt',
    'asset-schedule': 'Acha byen',
    'home-office': 'Biwo lakay',
    'bank-statements': 'Relve bank',
    'payroll-summary': 'Rezime salè',
    'property-tax': 'Taks pwopriyete',
    'rental-summary': 'Lwaye: antre ak depans',
    'closing-statement': 'Papye vant kay',
    charitable: 'Resi don',
    'medical-expenses': 'Depans medikal',
    childcare: 'Gadri timoun',
    'estimated-payments': 'Peman estime',
    'k12-educator': 'Depans pwofesè',
    'energy-credit': 'Resi enèji lakay',
    'photo-id': 'Kat idantite',
    'ssn-card': 'Kat Sekirite Sosyal',
    'voided-check': 'Enfòmasyon bank',
    'prior-return': 'Deklarasyon ane pase',
    'engagement-letter': 'Lèt angajman',
    organizer: 'Kesyonè taks',
    other: 'Lòt dokiman',
  },
};
