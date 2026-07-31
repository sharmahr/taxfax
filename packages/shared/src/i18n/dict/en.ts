/**
 * English — the source. Every string here is transcribed verbatim from the copy
 * that shipped before this module existed, and `check.ts` pins the rendered
 * output against a golden snapshot so it can never drift by a character.
 *
 * The one deliberate change: "It's been 9 days" is now plural-selected, so a
 * one-day wait reads "1 day" instead of "1 days". Every value the `firm` tone
 * can actually be sent at (day 11 and later on every profile) renders
 * identically to before.
 */

import type { Dictionary } from '../types.ts';

export const en: Dictionary = {
  locale: 'en',
  review: 'source',
  plural: {
    item: { one: 'item', other: 'items' },
    document: { one: 'document', other: 'documents' },
    day: { one: 'day', other: 'days' },
  },
  chase: {
    warm: {
      subject: 'Your {firmName} document checklist is ready',
      body: [
        'Hi {clientFirstName},',
        "We've built your document checklist for this year's return. It's {totalCount} {totalCount#item}, drawn from what was on your last return, so there's nothing on it you don't actually need.",
        '{bullets}',
        "You can upload straight from your phone — photos are fine, we'll straighten and rename everything.",
        '{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}: hi {clientFirstName}, we still need {topList} for your tax return. Upload in 2 min: {portalUrl} — reply STOP to opt out.',
    },
    neutral: {
      subject: '{outstandingCount} {outstandingCount#document} left for your return',
      body: ['Hi {clientFirstName},', '{lede}', '{bullets}', '{portalUrl}', '{signature}'],
      sms: '{firmName}: hi {clientFirstName}, we still need {topList} for your tax return. Upload in 2 min: {portalUrl} — reply STOP to opt out.',
    },
    firm: {
      subject: 'Still need: {topList}',
      body: [
        'Hi {clientFirstName},',
        "It's been {daysWaiting} {daysWaiting#day}. We can't start your return until these arrive:",
        '{bullets}',
        "If something on this list doesn't apply this year, reply and tell us — we'll take it off rather than keep asking.",
        '{portalUrl}',
        '{signature}',
      ],
      sms: "{firmName}: {daysWaiting} days waiting on {topList}. Your return can't start without it. {portalUrl} — reply STOP to opt out.",
    },
    urgent: {
      subject: 'Your return is on hold — {outstandingCount} {outstandingCount#item} missing',
      body: [
        '{clientFirstName},',
        "Your return is now the only thing standing between you and being finished, and it's waiting on {outstandingCount} {outstandingCount#document}:",
        '{bullets}',
        '{deadline}',
        'Upload here — it takes about two minutes:\n{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}: {outstandingCount} docs missing, {daysToDeadline} days to the deadline. {topList}. {portalUrl} — reply STOP to opt out.',
    },
    final: {
      subject: 'Extension likely — last call for your documents',
      body: [
        '{clientFirstName},',
        "This is our last automatic reminder. We still don't have:",
        '{bullets}',
        "Unless these arrive in the next few days we'll file an extension for you and pick this up afterwards. An extension gives you more time to file, not more time to pay, so any balance due still accrues interest from {deadlineDate}.",
        '{portalUrl}',
        "If there's a reason you're stuck, reply to this email and we'll sort it out directly.",
        '{signature}',
      ],
      sms: "{firmName}: last call — without {topList} we'll file an extension. {portalUrl} — reply STOP to opt out.",
    },
  },
  s: {
    'list.fallback': 'a few documents',
    'list.plus': ', plus {restCount} more',
    'bullet.more': '  …and {restCount} more',
    'neutral.ledeSome':
      "Thanks — we've got {doneCount} of {totalCount}. Still waiting on {outstandingCount}:",
    'neutral.ledeNone':
      "We're still waiting on all {outstandingCount} {outstandingCount#item}:",
    'urgent.deadlineNear':
      "The filing deadline is {daysToDeadline} days away. Past that we'd need to file an extension, which doesn't extend the deadline to pay.",
    'urgent.deadlineFar':
      'The longer this sits, the more likely we end up filing an extension.',
    'item.fromIssuer': '{code} from {issuers}',

    'portal.title': 'Your documents for {firmName}',
    'portal.progress': '{receivedCount} of {totalCount} received',
    'portal.needed': 'Still needed',
    'portal.done': 'Done · {doneCount}',
    'portal.upload': 'Upload',
    'portal.uploadHint':
      "A photo from your phone is fine — we straighten and rename everything for you.",
    'portal.uploadedCount': '{uploadedCount} of {expectedCount} uploaded',
    'portal.allDone': "That's everything. Nothing more to send.",
    'portal.whyAsked': 'Why we need this',
    'portal.help': 'Stuck? Reply to any of our emails and a person will answer.',
    'portal.language': 'Language',
    'portal.languageHint': 'Change the language we write to you in.',
    'portal.private': 'Private',
    'portal.needsAnotherTry': 'Needs another try: {detail}',
    'portal.yourAccountant': 'your accountant',
    'portal.loadFailed': 'We couldn’t load your list',
    'portal.loadFailedHint':
      'Check your connection and reload the page. Nothing you’ve sent is lost.',
    'portal.emptyTitle': 'Nothing needed right now',
    'portal.emptyHint': 'When {firmName} needs a document from you, it will show up here.',
    'portal.somethingElse': 'Something else?',
    'portal.somethingElseHint':
      'Have a document that isn’t on the list? Add it here and {firmName} will sort it out.',

    'upload.gotItIssuer': 'Got it — {code} from {issuer}.',
    'upload.gotItCode': 'Got it — {code}.',
    'upload.gotItSaved': 'Got it — saved to your file.',
    'upload.preparing': 'Preparing',
    'upload.percent': '{percent}%',
    'upload.failed': 'That upload didn’t go through.',
    'upload.unreadable': 'We couldn’t read that one. Try a clearer photo.',
    'upload.undo': 'Undo',
    'upload.undoLabel': 'Undo — remove {name}',
    'upload.removing': 'Removing…',
    'upload.removingLabel': 'Removing {name}',
    'upload.tryAgain': 'Try again',
    'upload.remove': 'Remove',
    'upload.cancel': 'Cancel',
    'upload.chooseFiles': 'Choose from your files',
    'upload.dropPrompt': 'Drag a photo or {format} here, or',
    'upload.chooseFile': 'choose a file',
    'upload.unsupported': 'That kind of file isn’t supported. Take a photo, or upload a {format}.',
    'upload.empty': 'That file looks empty. Try another.',
    'upload.tooLarge': 'That file is too large — the limit is {limit}.',
    'upload.photoTooLarge': 'That photo is too large — the limit is {limit}.',
    'upload.heicUnreadable':
      'We couldn’t read that photo on this device. Try taking it again, or upload a {format}.',
    'upload.heicFailed': 'We couldn’t process that photo. Try a {format} instead.',

    'signin.working': 'Signing you in securely…',
    'signin.confirmTitle': 'Confirm your email',
    'signin.confirmBody':
      'This link didn’t carry your email, so we need it once to confirm it’s you. Enter the address your accountant sent this to — that’s the only thing we check, no password.',
    'signin.emailLabel': 'Email address',
    'signin.continue': 'Continue',
    'signin.expiredTitle': 'Let’s get you a fresh link',
    'signin.expiredBody':
      'This secure link has expired or was already used. We can send you a new one.',
    'signin.expiredShort': 'This secure link has expired.',
    'signin.yourEmail': 'Your email address',
    'signin.sendLink': 'Email me a new link',
    'signin.sentTitle': 'Check your email',
    'signin.sentBody':
      'We sent a secure link to {email}. Open it on this device and you’re in — no password to remember.',

    'status.pending': 'Needed',
    'status.received': 'Received',
    'status.accepted': 'Accepted',
    'status.rejected': 'Needs another copy',
    'status.waived': 'Not needed',
  },
  reason: {
    'reason.engagement': 'Required before we can start work.',
    'reason.photoId': 'Needed to verify your identity when we e-file.',
    'reason.photoIdBoth': 'Both spouses need a current photo ID to e-file.',
    'reason.ipPin':
      'You used an IRS Identity Protection PIN on your {year} return. The IRS issues a new one every December.',
    'reason.priorReturn':
      "Send last year's complete return and we'll build the rest of this list from it automatically.",

    'reason.w2Issuers': 'Last year you had {count} {code} — from {issuers}.',
    'reason.w2IssuersMany': 'Last year you had {count} {code}s — from {issuers}.',
    'reason.w2Wages': 'Your {year} return reported {amount} of wages.',
    'reason.w2Each': 'One from each employer.',

    'reason.interestIssuers': 'Interest last year from {issuers}.',
    'reason.interestAmount': 'Your {year} return reported {amount} of interest income.',
    'reason.dividendsIssuers': 'Dividends last year from {issuers}.',
    'reason.dividendsAmount': 'Your {year} return reported {amount} of dividends.',
    'reason.brokerIssuers':
      'You filed {code} last year with activity at {issuers}. We need the full consolidated statement, including the cost-basis pages.',
    'reason.brokerSchedule':
      "You filed {code} last year, so we need your broker's consolidated {code2} — including the cost-basis detail.",

    'reason.retirement': 'Your {year} return reported {amount} from an IRA, pension, or annuity.',
    'reason.socialSecurity': 'You reported {amount} of Social Security benefits last year.',
    'reason.unemployment': 'You had unemployment or a state refund reported last year.',

    'reason.scheduleCMany':
      'You filed {count} {code}s last year — one profit & loss statement per business.',
    'reason.scheduleCIncome':
      'You filed {code} last year with {amount} of net business income. A full-year P&L is the fastest way to get this done.',
    'reason.scheduleC':
      'You filed {code} last year. A full-year P&L is the fastest way to get this done.',
    'reason.necIssuers': 'Last year you received {code}s from {issuers}.',
    'reason.necSelfEmployed':
      'You reported self-employment income last year — send any {code}s you receive.',
    'reason.paymentAppIssuers':
      'You received a {code} last year from {issuers}. The reporting threshold keeps dropping, so expect one again.',
    'reason.paymentApp':
      'You received a {code} last year. The reporting threshold keeps dropping, so expect one again.',
    'reason.mileage':
      'You claimed vehicle expenses last year. The IRS requires contemporaneous mileage records, so send your log or app export.',
    'reason.homeOffice':
      'You claimed a home office last year — we need this year’s square footage plus utilities, rent or mortgage interest, and insurance.',
    'reason.assets':
      'Send invoices for anything the business bought over $2,500 — equipment, vehicles, or improvements.',
    'reason.payroll': 'Year-end payroll reports ({codes}) reconcile wages on the return.',
    'reason.bankStatements':
      'You had business income last year but no bookkeeping file. Twelve months of statements let us build the P&L for you.',

    'reason.k1PartnershipIssuers':
      'You hold interests in {issuers}. Partnership {code}s often arrive late — send each as it comes.',
    'reason.k1Partnership': 'You received {count} partnership {code} last year.',
    'reason.k1PartnershipMany': 'You received {count} partnership {code}s last year.',
    'reason.k1SCorpIssuers': 'You’re a shareholder in {issuers}.',
    'reason.k1SCorp': 'You received {count} S-corporation {code} last year.',
    'reason.k1SCorpMany': 'You received {count} S-corporation {code}s last year.',
    'reason.k1Trust': 'You were a beneficiary of a trust or estate last year.',

    'reason.rentalMany':
      '{code} showed {count} rental properties last year — send income and expenses for each.',
    'reason.rentalOne':
      'You filed {code} last year. Send full-year rent collected plus expenses for the property.',
    'reason.mortgageIssuers': 'Mortgage interest last year from {issuers}.',
    'reason.mortgage': 'You deducted mortgage interest last year.',
    'reason.propertyTax': 'You deducted real estate taxes last year.',
    'reason.closing': 'Only if you bought, sold, or refinanced property this year.',

    'reason.charitableGave':
      'You itemized last year and gave {amount}. Anything over $250 needs a written acknowledgment from the charity.',
    'reason.charitable':
      'You itemized last year. Anything over $250 needs a written acknowledgment from the charity.',
    'reason.medical': 'You claimed {amount} of medical expenses last year.',
    'reason.studentLoan': 'You deducted student loan interest last year.',
    'reason.education': 'You claimed an education credit last year.',
    'reason.childcare':
      "You claimed the child and dependent care credit last year. We need the provider's name, address, and tax ID — not just the amount.",
    'reason.ira': 'You deducted an IRA contribution last year.',
    'reason.hsa': 'You filed Form {code} for an HSA last year.',
    'reason.hsaSpend': 'Needed if you spent from your HSA this year.',
    'reason.energy': 'You claimed a home energy credit last year.',
    'reason.educator': 'You claimed the educator expense deduction last year.',
    'reason.marketplace':
      'You had Marketplace coverage last year. Without Form {code} the IRS rejects the return outright.',

    'reason.estimatesTotal':
      'You made estimated payments last year totaling {amount}. We need the exact date and amount of each one.',
    'reason.estimates':
      'You made estimated payments last year. We need the exact date and amount of each one.',
    'reason.bankInfo': 'So any refund reaches you by direct deposit instead of a paper check.',
    'reason.refundDeposit': 'So a refund reaches you by direct deposit.',

    'reason.crypto':
      'You answered yes to the digital-asset question last year. Send a full transaction export from every exchange and wallet.',
  },
  docCode: {
    'crypto-report': 'Crypto',
    'profit-loss': 'P&L',
    'balance-sheet': 'Balance sheet',
    'mileage-log': 'Mileage',
    'asset-schedule': 'Assets',
    'home-office': 'Home office',
    'bank-statements': 'Statements',
    'payroll-summary': 'Payroll',
    'property-tax': 'Property tax',
    'rental-summary': 'Rental',
    'closing-statement': 'Closing',
    charitable: 'Charity',
    'medical-expenses': 'Medical',
    childcare: 'Childcare',
    'estimated-payments': 'Estimates',
    'k12-educator': 'Educator',
    'energy-credit': 'Energy',
    'photo-id': 'ID',
    'ssn-card': 'SSN',
    'voided-check': 'Bank',
    'prior-return': 'Prior return',
    'engagement-letter': 'Engagement',
    organizer: 'Organizer',
    other: 'Other',
  },
};
