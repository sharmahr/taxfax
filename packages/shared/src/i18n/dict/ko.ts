/**
 * Korean. IRS Publication 17 language.
 *
 * 합쇼체 (formal polite) throughout — anything softer is wrong from an
 * accountant writing about a tax filing. Korean takes no grammatical plural, so
 * every count uses the single CLDR `other` form; the counter word does the work
 * instead (건, 일).
 */

import type { Dictionary } from '../types.ts';

export const ko: Dictionary = {
  locale: 'ko',
  review: 'machine',
  plural: {
    item: { other: '건' },
    document: { other: '건' },
    day: { other: '일' },
  },
  chase: {
    warm: {
      subject: '{firmName} 세금 서류 목록이 준비되었습니다',
      body: [
        '{clientFirstName}님, 안녕하세요.',
        '작년 세금 신고서를 바탕으로 올해 신고에 필요한 서류 목록을 정리했습니다. 모두 {totalCount}{totalCount#item}이며, 실제로 필요한 것만 담았습니다.',
        '{bullets}',
        '휴대폰에서 바로 올리셔도 됩니다. 사진도 괜찮습니다. 저희가 자동으로 바로잡고 이름을 정리합니다.',
        '{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}: {clientFirstName}님, {topList} 아직 필요합니다. 2분이면 됩니다: {portalUrl} 수신거부 STOP',
    },
    neutral: {
      subject: '세금 신고에 {outstandingCount}{outstandingCount#document}이 남았습니다',
      body: ['{clientFirstName}님, 안녕하세요.', '{lede}', '{bullets}', '{portalUrl}', '{signature}'],
      sms: '{firmName}: {topList} 아직 기다리고 있습니다. {portalUrl} 수신거부 STOP',
    },
    firm: {
      subject: '아직 필요합니다: {topList}',
      body: [
        '{clientFirstName}님, 안녕하세요.',
        '{daysWaiting}{daysWaiting#day}째 기다리고 있습니다. 아래 서류가 도착해야 신고를 시작할 수 있습니다.',
        '{bullets}',
        '올해 해당되지 않는 항목이 있으면 답장으로 알려 주십시오. 계속 요청드리는 대신 목록에서 빼겠습니다.',
        '{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}: {daysWaiting}일째 {topList} 대기 중입니다. 신고를 시작할 수 없습니다. {portalUrl} 수신거부 STOP',
    },
    urgent: {
      subject: '신고가 보류 중입니다 — {outstandingCount}{outstandingCount#item} 누락',
      body: [
        '{clientFirstName}님,',
        '이제 이것만 해결되면 신고가 끝납니다. {outstandingCount}{outstandingCount#document}을 기다리고 있습니다.',
        '{bullets}',
        '{deadline}',
        '여기에서 올리시면 됩니다. 2분이면 충분합니다:\n{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}: {outstandingCount}건 누락, 마감까지 {daysToDeadline}일. {topList}. {portalUrl} 수신거부 STOP',
    },
    final: {
      subject: '연장 신고 가능성 — 서류 마지막 안내',
      body: [
        '{clientFirstName}님,',
        '자동 안내는 이번이 마지막입니다. 아직 받지 못한 서류입니다.',
        '{bullets}',
        '며칠 안에 도착하지 않으면 연장 신고를 접수하고 이후에 이어서 진행하겠습니다. 연장은 신고 기한만 늘려 줄 뿐 납부 기한은 늘려 주지 않으므로, 미납 세액에는 {deadlineDate}부터 이자가 붙습니다.',
        '{portalUrl}',
        '어려운 사정이 있으시면 이 메일에 답장해 주십시오. 직접 도와드리겠습니다.',
        '{signature}',
      ],
      sms: '{firmName}: 마지막 안내입니다. {topList} 없이는 연장 신고로 진행합니다. {portalUrl} 수신거부 STOP',
    },
  },
  s: {
    'list.fallback': '몇 가지 서류',
    'list.plus': ' 외 {restCount}건',
    'bullet.more': '  …외 {restCount}건',
    'neutral.ledeSome':
      '감사합니다. {totalCount}건 중 {doneCount}건을 받았습니다. 남은 {outstandingCount}건입니다.',
    'neutral.ledeNone': '{outstandingCount}{outstandingCount#item} 모두 아직 받지 못했습니다.',
    'urgent.deadlineNear':
      '신고 마감까지 {daysToDeadline}일 남았습니다. 그 이후에는 연장 신고를 해야 하며, 연장은 납부 기한까지 늦춰 주지는 않습니다.',
    'urgent.deadlineFar': '늦어질수록 연장 신고로 갈 가능성이 높아집니다.',
    'item.fromIssuer': '{issuers}의 {code}',

    'portal.title': '{firmName} 세금 서류',
    'portal.progress': '{totalCount}건 중 {receivedCount}건 접수',
    'portal.needed': '아직 필요한 서류',
    'portal.upload': '올리기',
    'portal.uploadHint': '휴대폰 사진이면 충분합니다. 저희가 바로잡고 이름을 정리합니다.',
    'portal.allDone': '모두 접수되었습니다. 더 보내실 서류는 없습니다.',
    'portal.whyAsked': '이 서류가 필요한 이유',
    'portal.help': '막히셨나요? 저희 메일 아무 데나 답장하시면 담당자가 답변드립니다.',
    'portal.language': '언어',
    'portal.languageHint': '연락드릴 때 사용하는 언어를 바꿉니다.',
    'portal.loadFailed': '목록을 불러오지 못했습니다',
    'portal.loadFailedHint':
      '연결 상태를 확인하고 페이지를 새로 고쳐 주세요. 보내 주신 자료는 그대로 있습니다.',
    'portal.emptyTitle': '지금은 필요한 서류가 없습니다',
    'portal.emptyHint': '{firmName}에서 서류가 필요해지면 여기에 표시됩니다.',
    'portal.somethingElse': '그 밖에 보내실 것이 있나요?',

    'upload.gotItIssuer': '{issuer}의 {code}, 잘 받았습니다.',
    'upload.gotItCode': '{code}, 잘 받았습니다.',
    'upload.gotItSaved': '잘 받았습니다. 파일에 저장해 두었습니다.',
    'upload.preparing': '준비 중',
    'upload.failed': '이 파일은 업로드되지 않았습니다.',
    'upload.unreadable': '이 파일은 알아보기 어렵습니다. 더 선명한 사진으로 다시 올려 주세요.',
    'upload.undo': '되돌리기',
    'upload.undoLabel': '되돌리기 — {name} 삭제',
    'upload.removing': '삭제 중…',
    'upload.removingLabel': '{name} 삭제 중',

    'signin.working': '안전하게 로그인하는 중…',
    'signin.confirmTitle': '이메일 주소를 확인해 주세요',
    'signin.confirmBody':
      '이 링크에 이메일 주소가 담겨 있지 않아, 본인 확인을 위해 한 번만 입력이 필요합니다. 회계사가 이 링크를 보낸 주소를 입력해 주세요. 확인하는 것은 그것뿐이며, 비밀번호는 없습니다.',
    'signin.emailLabel': '이메일 주소',
    'signin.continue': '계속',
    'signin.expiredTitle': '새 링크를 보내 드리겠습니다',
    'signin.expiredBody':
      '이 보안 링크는 만료되었거나 이미 사용되었습니다. 새로 보내 드릴 수 있습니다.',
    'signin.expiredShort': '이 보안 링크는 만료되었습니다.',
    'signin.yourEmail': '이메일 주소',
    'signin.sendLink': '새 링크 보내 주세요',
    'signin.sentTitle': '이메일을 확인해 주세요',
    'signin.sentBody':
      '{email}(으)로 보안 링크를 보냈습니다. 이 기기에서 열면 바로 로그인되며, 기억할 비밀번호는 없습니다.',

    'status.pending': '필요',
    'status.received': '접수됨',
    'status.accepted': '확인 완료',
    'status.rejected': '다시 올려 주세요',
    'status.waived': '해당 없음',
  },
  docCode: {
    'crypto-report': '가상자산 거래내역',
    'profit-loss': '손익계산서',
    'balance-sheet': '재무상태표',
    'mileage-log': '주행거리 기록',
    'asset-schedule': '자산 취득 내역',
    'home-office': '재택 사무실',
    'bank-statements': '은행·카드 명세서',
    'payroll-summary': '급여 총괄표',
    'property-tax': '재산세 고지서',
    'rental-summary': '임대 수입·지출',
    'closing-statement': '부동산 결제 명세서',
    charitable: '기부금 영수증',
    'medical-expenses': '의료비 내역',
    childcare: '보육비 내역',
    'estimated-payments': '예납 세액',
    'k12-educator': '교사 지출',
    'energy-credit': '주택 에너지 개선 영수증',
    'photo-id': '신분증',
    'ssn-card': '소셜시큐리티 카드',
    'voided-check': '은행 계좌 정보',
    'prior-return': '작년 신고서',
    'engagement-letter': '업무 약정서',
    organizer: '세무 질문지',
    other: '기타 서류',
  },
};
