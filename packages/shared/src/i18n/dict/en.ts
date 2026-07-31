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
    'portal.upload': 'Upload',
    'portal.uploadHint':
      "A photo from your phone is fine — we straighten and rename everything for you.",
    'portal.allDone': "That's everything. Nothing more to send.",
    'portal.whyAsked': 'Why we need this',
    'portal.help': 'Stuck? Reply to any of our emails and a person will answer.',
    'portal.language': 'Language',
    'portal.languageHint': 'Change the language we write to you in.',
    'portal.loadFailed': 'We couldn’t load your list',
    'portal.loadFailedHint':
      'Check your connection and reload the page. Nothing you’ve sent is lost.',
    'portal.emptyTitle': 'Nothing needed right now',
    'portal.emptyHint': 'When {firmName} needs a document from you, it will show up here.',
    'portal.somethingElse': 'Something else?',

    'upload.gotItIssuer': 'Got it — {code} from {issuer}.',
    'upload.gotItCode': 'Got it — {code}.',
    'upload.gotItSaved': 'Got it — saved to your file.',
    'upload.preparing': 'Preparing',
    'upload.failed': 'That upload didn’t go through.',
    'upload.unreadable': 'We couldn’t read that one. Try a clearer photo.',
    'upload.undo': 'Undo',
    'upload.undoLabel': 'Undo — remove {name}',
    'upload.removing': 'Removing…',
    'upload.removingLabel': 'Removing {name}',

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
