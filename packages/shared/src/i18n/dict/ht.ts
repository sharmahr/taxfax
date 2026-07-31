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
    'status.pending': 'Bezwen',
    'status.received': 'Resevwa',
    'status.accepted': 'Aksepte',
    'status.rejected': 'Bezwen yon lòt kopi',
    'status.waived': 'Pa nesesè',
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
