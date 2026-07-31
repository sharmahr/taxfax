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
    'portal.done': '완료 · {doneCount}',
    'portal.uploadedCount': '{expectedCount}건 중 {uploadedCount}건 업로드',
    'portal.private': '비공개',
    'portal.needsAnotherTry': '다시 보내 주세요: {detail}',
    'portal.yourAccountant': '담당 회계사',
    'portal.somethingElseHint':
      '목록에 없는 서류가 있으신가요? 여기에 올려 주시면 {firmName}에서 정리해 드립니다.',

    'upload.percent': '{percent}%',
    'upload.tryAgain': '다시 시도',
    'upload.remove': '삭제',
    'upload.cancel': '취소',
    'upload.chooseFiles': '내 파일에서 고르기',
    'upload.dropPrompt': '사진이나 {format} 파일을 여기로 끌어 놓으시거나,',
    'upload.chooseFile': '파일 선택',
    'upload.unsupported': '지원하지 않는 형식입니다. 사진을 찍으시거나 {format} 파일을 올려 주세요.',
    'upload.empty': '빈 파일로 보입니다. 다른 파일로 시도해 주세요.',
    'upload.tooLarge': '파일이 너무 큽니다. 최대 {limit}까지 가능합니다.',
    'upload.photoTooLarge': '사진이 너무 큽니다. 최대 {limit}까지 가능합니다.',
    'upload.heicUnreadable':
      '이 기기에서는 사진을 읽지 못했습니다. 다시 찍으시거나 {format} 파일로 올려 주세요.',
    'upload.heicFailed': '사진을 처리하지 못했습니다. {format} 파일로 보내 주세요.',
  },
  reason: {
    'reason.engagement': '업무를 시작하기 전에 반드시 필요합니다.',
    'reason.photoId': '전자신고 때 본인 확인에 필요합니다.',
    'reason.photoIdBoth': '전자신고를 하려면 부부 두 분 모두 유효한 사진 신분증이 필요합니다.',
    'reason.ipPin':
      '{year}년 신고서에 IRS 신원보호 PIN을 사용하셨습니다. IRS는 매년 12월에 새 번호를 발급합니다.',
    'reason.priorReturn':
      '작년 신고서 전체를 보내 주시면 나머지 목록은 저희가 자동으로 채웁니다.',

    'reason.w2Issuers': '작년에 {issuers}에서 받으신 {code}이 {count}장 있었습니다.',
    'reason.w2IssuersMany': '작년에 {issuers}에서 받으신 {code}이 {count}장 있었습니다.',
    'reason.w2Wages': '{year}년 신고서에 급여 {amount}이 보고되었습니다.',
    'reason.w2Each': '고용주마다 한 장씩 필요합니다.',

    'reason.interestIssuers': '작년에 {issuers}에서 이자를 받으셨습니다.',
    'reason.interestAmount': '{year}년 신고서에 이자소득 {amount}이 보고되었습니다.',
    'reason.dividendsIssuers': '작년에 {issuers}에서 배당을 받으셨습니다.',
    'reason.dividendsAmount': '{year}년 신고서에 배당소득 {amount}이 보고되었습니다.',
    'reason.brokerIssuers':
      '작년에 {code}을 제출하셨고 {issuers}에 거래가 있었습니다. 취득원가 페이지를 포함한 통합 명세서 전부가 필요합니다.',
    'reason.brokerSchedule':
      '작년에 {code}을 제출하셨으므로 증권사의 통합 {code2}이 필요합니다. 취득원가 내역도 함께 보내 주세요.',

    'reason.retirement':
      '{year}년 신고서에 IRA·연금·연금보험에서 나온 {amount}이 보고되었습니다.',
    'reason.socialSecurity': '작년에 사회보장 급여 {amount}을 신고하셨습니다.',
    'reason.unemployment': '작년에 실업급여 또는 주 세금 환급이 신고되었습니다.',

    'reason.scheduleCMany':
      '작년에 {code}을 {count}장 제출하셨습니다. 사업체마다 손익계산서가 한 장씩 필요합니다.',
    'reason.scheduleCIncome':
      '작년에 사업 순소득 {amount}으로 {code}을 제출하셨습니다. 연간 손익계산서가 가장 빠른 방법입니다.',
    'reason.scheduleC': '작년에 {code}을 제출하셨습니다. 연간 손익계산서가 가장 빠른 방법입니다.',
    'reason.necIssuers': '작년에 {issuers}에서 {code}을 받으셨습니다.',
    'reason.necSelfEmployed': '작년에 자영업 소득을 신고하셨습니다. 받으시는 {code}을 모두 보내 주세요.',
    'reason.paymentAppIssuers':
      '작년에 {issuers}에서 {code}을 받으셨습니다. 보고 기준액이 계속 낮아지고 있어 올해도 나올 가능성이 큽니다.',
    'reason.paymentApp':
      '작년에 {code}을 받으셨습니다. 보고 기준액이 계속 낮아지고 있어 올해도 나올 가능성이 큽니다.',
    'reason.mileage':
      '작년에 차량 비용을 공제하셨습니다. IRS는 그때그때 적은 주행 기록을 요구하므로 기록장이나 앱에서 내려받은 파일을 보내 주세요.',
    'reason.homeOffice':
      '작년에 재택 사무실을 공제하셨습니다. 올해 면적과 함께 공과금, 임차료 또는 주택담보대출 이자, 보험료가 필요합니다.',
    'reason.assets':
      '사업체가 $2,500 넘게 구입한 것은 모두 청구서를 보내 주세요. 장비, 차량, 시설 개선 등입니다.',
    'reason.payroll': '연말 급여 보고서({codes})로 신고서의 급여를 대조합니다.',
    'reason.bankStatements':
      '작년에 사업 소득은 있었지만 장부 파일이 없습니다. 12개월치 거래내역서를 주시면 손익계산서를 저희가 만들어 드립니다.',

    'reason.k1PartnershipIssuers':
      '{issuers}의 지분을 보유하고 계십니다. 파트너십 {code}은 늦게 오는 일이 잦으니 받는 대로 보내 주세요.',
    'reason.k1Partnership': '작년에 파트너십 {code}을 {count}장 받으셨습니다.',
    'reason.k1PartnershipMany': '작년에 파트너십 {code}을 {count}장 받으셨습니다.',
    'reason.k1SCorpIssuers': '{issuers}의 주주이십니다.',
    'reason.k1SCorp': '작년에 S 법인 {code}을 {count}장 받으셨습니다.',
    'reason.k1SCorpMany': '작년에 S 법인 {code}을 {count}장 받으셨습니다.',
    'reason.k1Trust': '작년에 신탁 또는 상속재산의 수익자이셨습니다.',

    'reason.rentalMany':
      '작년 {code}에 임대 부동산이 {count}건 나와 있습니다. 각 물건의 수입과 지출을 보내 주세요.',
    'reason.rentalOne':
      '작년에 {code}을 제출하셨습니다. 그 물건의 연간 임대 수입과 지출을 보내 주세요.',
    'reason.mortgageIssuers': '작년에 {issuers}에 주택담보대출 이자를 내셨습니다.',
    'reason.mortgage': '작년에 주택담보대출 이자를 공제하셨습니다.',
    'reason.propertyTax': '작년에 재산세를 공제하셨습니다.',
    'reason.closing': '올해 부동산을 사거나 팔거나 대출을 갈아타신 경우에만 필요합니다.',

    'reason.charitableGave':
      '작년에 항목별 공제를 하시면서 {amount}을 기부하셨습니다. $250이 넘는 기부는 단체가 발급한 서면 확인서가 필요합니다.',
    'reason.charitable':
      '작년에 항목별 공제를 하셨습니다. $250이 넘는 기부는 단체가 발급한 서면 확인서가 필요합니다.',
    'reason.medical': '작년에 의료비 {amount}을 공제받으셨습니다.',
    'reason.studentLoan': '작년에 학자금 대출 이자를 공제하셨습니다.',
    'reason.education': '작년에 교육 세액공제를 받으셨습니다.',
    'reason.childcare':
      '작년에 자녀·부양가족 돌봄 세액공제를 받으셨습니다. 금액만이 아니라 돌봄 제공자의 이름, 주소, 납세자번호가 필요합니다.',
    'reason.ira': '작년에 IRA 납입금을 공제하셨습니다.',
    'reason.hsa': '작년에 HSA 때문에 {code} 양식을 제출하셨습니다.',
    'reason.hsaSpend': '올해 HSA에서 지출하셨다면 필요합니다.',
    'reason.energy': '작년에 주택 에너지 세액공제를 받으셨습니다.',
    'reason.educator': '작년에 교원 경비 공제를 받으셨습니다.',
    'reason.marketplace':
      '작년에 마켓플레이스 보험에 가입하셨습니다. {code} 양식이 없으면 IRS가 신고서를 그대로 반려합니다.',

    'reason.estimatesTotal':
      '작년에 추정세를 모두 {amount} 납부하셨습니다. 납부 건마다 정확한 날짜와 금액이 필요합니다.',
    'reason.estimates':
      '작년에 추정세를 납부하셨습니다. 납부 건마다 정확한 날짜와 금액이 필요합니다.',
    'reason.bankInfo': '환급금이 종이 수표가 아니라 계좌로 바로 들어가도록 하기 위해서입니다.',
    'reason.refundDeposit': '환급금이 계좌로 바로 들어가도록 하기 위해서입니다.',

    'reason.crypto':
      '작년에 디지털 자산 질문에 "예"라고 답하셨습니다. 거래소와 지갑마다 전체 거래 내역을 내려받아 보내 주세요.',
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
