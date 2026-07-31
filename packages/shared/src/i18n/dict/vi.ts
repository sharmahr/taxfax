/**
 * Vietnamese. IRS Publication 17 language.
 *
 * "Quý vị" throughout — the register US Vietnamese-language government and
 * professional correspondence uses, and the one the IRS itself uses in its
 * Vietnamese publications. Vietnamese takes no grammatical plural, but its
 * diacritics are outside GSM-7, so every SMS here is UCS-2 at 70 characters a
 * segment. Do not strip the tone marks to save a segment: without them the
 * words change meaning.
 */

import type { Dictionary } from '../types.ts';

export const vi: Dictionary = {
  locale: 'vi',
  review: 'machine',
  plural: {
    item: { other: 'mục' },
    document: { other: 'giấy tờ' },
    day: { other: 'ngày' },
  },
  chase: {
    warm: {
      subject: 'Danh sách giấy tờ khai thuế của quý vị tại {firmName} đã sẵn sàng',
      body: [
        'Chào {clientFirstName},',
        'Chúng tôi đã lập danh sách giấy tờ cho hồ sơ thuế năm nay, dựa trên tờ khai năm ngoái của quý vị. Tất cả {totalCount} {totalCount#item}, và không có mục nào là thừa.',
        '{bullets}',
        'Quý vị có thể tải lên thẳng từ điện thoại. Chụp hình cũng được, chúng tôi sẽ tự chỉnh thẳng và đặt tên lại.',
        '{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}: {clientFirstName} ơi, còn thiếu {topList}. Tải lên: {portalUrl}. STOP để ngưng.',
    },
    neutral: {
      subject: 'Còn {outstandingCount} {outstandingCount#document} cho hồ sơ thuế của quý vị',
      body: ['Chào {clientFirstName},', '{lede}', '{bullets}', '{portalUrl}', '{signature}'],
      sms: '{firmName}: chúng tôi vẫn đang chờ {topList}. {portalUrl}. STOP để ngưng.',
    },
    firm: {
      subject: 'Vẫn cần: {topList}',
      body: [
        'Chào {clientFirstName},',
        'Đã {daysWaiting} {daysWaiting#day}. Chúng tôi chưa thể bắt đầu hồ sơ thuế cho tới khi nhận được:',
        '{bullets}',
        'Nếu mục nào năm nay không áp dụng cho quý vị, xin trả lời cho chúng tôi biết. Chúng tôi sẽ bỏ mục đó thay vì hỏi hoài.',
        '{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}: đã chờ {daysWaiting} ngày {topList}. Chưa thể bắt đầu hồ sơ. {portalUrl}. STOP để ngưng.',
    },
    urgent: {
      subject: 'Hồ sơ thuế đang tạm ngưng — thiếu {outstandingCount} {outstandingCount#item}',
      body: [
        '{clientFirstName},',
        'Chỉ còn bước này nữa là xong hồ sơ thuế của quý vị. Chúng tôi đang chờ {outstandingCount} {outstandingCount#document}:',
        '{bullets}',
        '{deadline}',
        'Tải lên tại đây, mất chừng hai phút:\n{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}: thiếu {outstandingCount} giấy tờ, còn {daysToDeadline} ngày. {topList}. {portalUrl}. STOP để ngưng.',
    },
    final: {
      subject: 'Có thể phải xin gia hạn — nhắc lần cuối về giấy tờ',
      body: [
        '{clientFirstName},',
        'Đây là lời nhắc tự động cuối cùng. Chúng tôi vẫn chưa nhận được:',
        '{bullets}',
        'Nếu vài ngày nữa vẫn chưa có, chúng tôi sẽ xin gia hạn cho quý vị rồi làm tiếp sau. Gia hạn cho thêm thời gian nộp tờ khai, chứ không cho thêm thời gian đóng tiền, nên số thuế còn thiếu vẫn tính lãi kể từ {deadlineDate}.',
        '{portalUrl}',
        'Nếu có gì vướng mắc, xin trả lời email này, chúng tôi sẽ giải quyết trực tiếp.',
        '{signature}',
      ],
      sms: '{firmName}: nhắc lần cuối. Thiếu {topList} là phải xin gia hạn. {portalUrl}. STOP để ngưng.',
    },
  },
  s: {
    'list.fallback': 'một vài giấy tờ',
    'list.plus': ', và {restCount} mục nữa',
    'bullet.more': '  …và {restCount} mục nữa',
    'neutral.ledeSome':
      'Cảm ơn quý vị. Chúng tôi đã nhận {doneCount} trong {totalCount}. Còn chờ {outstandingCount}:',
    'neutral.ledeNone': 'Chúng tôi vẫn đang chờ cả {outstandingCount} {outstandingCount#item}:',
    'urgent.deadlineNear':
      'Còn {daysToDeadline} ngày nữa là tới hạn khai thuế. Quá hạn thì phải xin gia hạn, mà gia hạn không dời hạn đóng tiền.',
    'urgent.deadlineFar': 'Càng để lâu thì càng dễ phải xin gia hạn.',
    'item.fromIssuer': '{code} từ {issuers}',

    'portal.title': 'Giấy tờ của quý vị tại {firmName}',
    'portal.progress': 'Đã nhận {receivedCount} trong {totalCount}',
    'portal.needed': 'Vẫn còn cần',
    'portal.upload': 'Tải lên',
    'portal.uploadHint':
      'Chụp hình bằng điện thoại là được. Chúng tôi sẽ chỉnh thẳng và đặt tên lại giúp quý vị.',
    'portal.allDone': 'Vậy là đủ hết rồi. Quý vị không cần gửi thêm gì nữa.',
    'portal.whyAsked': 'Vì sao cần giấy tờ này',
    'portal.help': 'Gặp khó khăn? Trả lời bất kỳ email nào của chúng tôi, sẽ có người trả lời.',
    'portal.language': 'Ngôn ngữ',
    'portal.languageHint': 'Đổi ngôn ngữ chúng tôi dùng khi liên lạc với quý vị.',
    'portal.loadFailed': 'Không tải được danh sách của quý vị',
    'portal.loadFailedHint':
      'Vui lòng kiểm tra kết nối và tải lại trang. Những gì quý vị đã gửi vẫn còn nguyên.',
    'portal.emptyTitle': 'Hiện chưa cần giấy tờ nào',
    'portal.emptyHint': 'Khi {firmName} cần giấy tờ từ quý vị, nó sẽ hiện ở đây.',
    'portal.somethingElse': 'Còn gì nữa không?',

    'upload.gotItIssuer': 'Đã nhận — {code} từ {issuer}.',
    'upload.gotItCode': 'Đã nhận — {code}.',
    'upload.gotItSaved': 'Đã nhận — chúng tôi đã lưu vào hồ sơ của quý vị.',
    'upload.preparing': 'Đang chuẩn bị',
    'upload.failed': 'Tải lên không thành công.',
    'upload.unreadable': 'Chúng tôi không đọc được tấm này. Quý vị chụp lại rõ hơn giúp nhé.',
    'upload.undo': 'Hoàn tác',
    'upload.undoLabel': 'Hoàn tác — xóa {name}',
    'upload.removing': 'Đang xóa…',
    'upload.removingLabel': 'Đang xóa {name}',

    'signin.working': 'Đang đăng nhập an toàn cho quý vị…',
    'signin.confirmTitle': 'Xác nhận email của quý vị',
    'signin.confirmBody':
      'Đường liên kết này không kèm theo email của quý vị, nên chúng tôi cần quý vị nhập một lần để xác nhận đúng người. Xin nhập địa chỉ mà kế toán viên đã gửi tới — chúng tôi chỉ kiểm tra chừng đó, không cần mật khẩu.',
    'signin.emailLabel': 'Địa chỉ email',
    'signin.continue': 'Tiếp tục',
    'signin.expiredTitle': 'Chúng tôi gửi quý vị đường liên kết mới',
    'signin.expiredBody':
      'Đường liên kết an toàn này đã hết hạn hoặc đã được dùng rồi. Chúng tôi có thể gửi quý vị một cái mới.',
    'signin.expiredShort': 'Đường liên kết an toàn này đã hết hạn.',
    'signin.yourEmail': 'Địa chỉ email của quý vị',
    'signin.sendLink': 'Gửi cho tôi đường liên kết mới',
    'signin.sentTitle': 'Xin kiểm tra email',
    'signin.sentBody':
      'Chúng tôi đã gửi một đường liên kết an toàn tới {email}. Quý vị mở nó ngay trên máy này là vào được, không cần nhớ mật khẩu.',

    'status.pending': 'Cần nộp',
    'status.received': 'Đã nhận',
    'status.accepted': 'Đã duyệt',
    'status.rejected': 'Cần gửi lại bản khác',
    'status.waived': 'Không cần',
    'portal.done': 'Xong · {doneCount}',
    'portal.uploadedCount': 'Đã tải lên {uploadedCount} trong {expectedCount}',
    'portal.private': 'Riêng tư',
    'portal.needsAnotherTry': 'Cần gửi lại: {detail}',
    'portal.yourAccountant': 'kế toán của quý vị',
    'portal.somethingElseHint':
      'Quý vị có giấy tờ không nằm trong danh sách? Thêm vào đây, {firmName} sẽ xử lý.',

    'upload.percent': '{percent}%',
    'upload.tryAgain': 'Thử lại',
    'upload.remove': 'Bỏ ra',
    'upload.cancel': 'Hủy',
    'upload.chooseFiles': 'Chọn từ tệp của quý vị',
    'upload.dropPrompt': 'Kéo hình hoặc {format} vào đây, hoặc',
    'upload.chooseFile': 'chọn một tệp',
    'upload.unsupported': 'Loại tệp đó không dùng được. Xin chụp hình, hoặc tải lên {format}.',
    'upload.empty': 'Tệp đó có vẻ trống. Xin thử tệp khác.',
    'upload.tooLarge': 'Tệp đó quá lớn — giới hạn là {limit}.',
    'upload.photoTooLarge': 'Hình đó quá lớn — giới hạn là {limit}.',
    'upload.heicUnreadable':
      'Máy này không đọc được hình đó. Xin chụp lại, hoặc tải lên {format}.',
    'upload.heicFailed': 'Chúng tôi không xử lý được hình đó. Xin thử {format}.',
  },
  reason: {
    'reason.engagement': 'Cần có trước khi chúng tôi bắt đầu làm.',
    'reason.photoId': 'Cần để xác minh danh tính khi chúng tôi khai thuế điện tử.',
    'reason.photoIdBoth':
      'Cả hai vợ chồng đều cần giấy tờ tùy thân có hình còn hiệu lực để khai thuế điện tử.',
    'reason.ipPin':
      'Quý vị đã dùng mã PIN Bảo vệ Danh tính của IRS trên tờ khai {year}. IRS cấp mã mới mỗi tháng 12.',
    'reason.priorReturn':
      'Xin gửi tờ khai đầy đủ của năm ngoái; từ đó chúng tôi tự lập phần còn lại của danh sách này.',

    'reason.w2Issuers': 'Năm ngoái quý vị có {count} {code} — từ {issuers}.',
    'reason.w2IssuersMany': 'Năm ngoái quý vị có {count} {code} — từ {issuers}.',
    'reason.w2Wages': 'Tờ khai {year} của quý vị ghi {amount} tiền lương.',
    'reason.w2Each': 'Mỗi hãng làm việc một tờ.',

    'reason.interestIssuers': 'Năm ngoái quý vị có tiền lãi từ {issuers}.',
    'reason.interestAmount': 'Tờ khai {year} của quý vị ghi {amount} tiền lãi.',
    'reason.dividendsIssuers': 'Năm ngoái quý vị có cổ tức từ {issuers}.',
    'reason.dividendsAmount': 'Tờ khai {year} của quý vị ghi {amount} cổ tức.',
    'reason.brokerIssuers':
      'Năm ngoái quý vị đã nộp {code} với giao dịch tại {issuers}. Chúng tôi cần bản sao kê tổng hợp đầy đủ, kể cả các trang giá vốn.',
    'reason.brokerSchedule':
      'Năm ngoái quý vị đã nộp {code}, nên chúng tôi cần bản {code2} tổng hợp của công ty môi giới — kèm chi tiết giá vốn.',

    'reason.retirement':
      'Tờ khai {year} của quý vị ghi {amount} từ IRA, tiền hưu hoặc niên kim.',
    'reason.socialSecurity': 'Năm ngoái quý vị khai {amount} tiền An Sinh Xã Hội.',
    'reason.unemployment':
      'Năm ngoái có khai tiền thất nghiệp hoặc tiền hoàn thuế của tiểu bang.',

    'reason.scheduleCMany':
      'Năm ngoái quý vị đã nộp {count} {code} — mỗi cơ sở kinh doanh một bảng lời lỗ.',
    'reason.scheduleCIncome':
      'Năm ngoái quý vị đã nộp {code} với {amount} lợi tức kinh doanh ròng. Bảng lời lỗ cả năm là cách nhanh nhất để xong việc.',
    'reason.scheduleC':
      'Năm ngoái quý vị đã nộp {code}. Bảng lời lỗ cả năm là cách nhanh nhất để xong việc.',
    'reason.necIssuers': 'Năm ngoái quý vị nhận {code} từ {issuers}.',
    'reason.necSelfEmployed':
      'Năm ngoái quý vị khai lợi tức tự làm chủ — xin gửi mọi {code} quý vị nhận được.',
    'reason.paymentAppIssuers':
      'Năm ngoái quý vị nhận {code} từ {issuers}. Mức phải khai báo ngày càng thấp, nên năm nay chắc cũng có.',
    'reason.paymentApp':
      'Năm ngoái quý vị nhận {code}. Mức phải khai báo ngày càng thấp, nên năm nay chắc cũng có.',
    'reason.mileage':
      'Năm ngoái quý vị khai chi phí xe. IRS đòi sổ ghi số dặm ghi ngay lúc đi, nên xin gửi sổ hoặc bản xuất từ ứng dụng.',
    'reason.homeOffice':
      'Năm ngoái quý vị khai văn phòng tại nhà — chúng tôi cần diện tích năm nay, cùng tiền điện nước, tiền thuê hoặc tiền lãi nhà, và bảo hiểm.',
    'reason.assets':
      'Xin gửi hóa đơn của mọi thứ cơ sở kinh doanh mua trên $2,500 — máy móc, xe cộ hoặc sửa chữa nâng cấp.',
    'reason.payroll':
      'Báo cáo lương cuối năm ({codes}) dùng để đối chiếu tiền lương trên tờ khai.',
    'reason.bankStatements':
      'Năm ngoái quý vị có lợi tức kinh doanh nhưng không có sổ sách. Mười hai tháng sao kê đủ để chúng tôi lập bảng lời lỗ giúp quý vị.',

    'reason.k1PartnershipIssuers':
      'Quý vị có phần hùn trong {issuers}. {code} của công ty hợp danh thường về trễ — nhận tờ nào xin gửi tờ đó.',
    'reason.k1Partnership': 'Năm ngoái quý vị nhận {count} {code} của công ty hợp danh.',
    'reason.k1PartnershipMany': 'Năm ngoái quý vị nhận {count} {code} của công ty hợp danh.',
    'reason.k1SCorpIssuers': 'Quý vị là cổ đông của {issuers}.',
    'reason.k1SCorp': 'Năm ngoái quý vị nhận {count} {code} của công ty S.',
    'reason.k1SCorpMany': 'Năm ngoái quý vị nhận {count} {code} của công ty S.',
    'reason.k1Trust': 'Năm ngoái quý vị là người thụ hưởng của một quỹ tín thác hoặc di sản.',

    'reason.rentalMany':
      '{code} cho thấy năm ngoái quý vị có {count} căn nhà cho thuê — xin gửi thu và chi của từng căn.',
    'reason.rentalOne':
      'Năm ngoái quý vị đã nộp {code}. Xin gửi tiền thuê thu cả năm cùng các khoản chi của căn nhà.',
    'reason.mortgageIssuers': 'Năm ngoái quý vị trả tiền lãi nhà cho {issuers}.',
    'reason.mortgage': 'Năm ngoái quý vị khấu trừ tiền lãi nợ nhà.',
    'reason.propertyTax': 'Năm ngoái quý vị khấu trừ thuế bất động sản.',
    'reason.closing': 'Chỉ khi năm nay quý vị mua, bán hoặc tái tài trợ nhà đất.',

    'reason.charitableGave':
      'Năm ngoái quý vị khai khấu trừ từng khoản và đã cho {amount}. Khoản nào trên $250 cần giấy xác nhận của hội từ thiện.',
    'reason.charitable':
      'Năm ngoái quý vị khai khấu trừ từng khoản. Khoản nào trên $250 cần giấy xác nhận của hội từ thiện.',
    'reason.medical': 'Năm ngoái quý vị khai {amount} chi phí y tế.',
    'reason.studentLoan': 'Năm ngoái quý vị khấu trừ tiền lãi nợ sinh viên.',
    'reason.education': 'Năm ngoái quý vị xin tín thuế học vấn.',
    'reason.childcare':
      'Năm ngoái quý vị xin tín thuế chăm sóc con và người phụ thuộc. Chúng tôi cần tên, địa chỉ và mã số thuế của nơi giữ trẻ — không chỉ số tiền.',
    'reason.ira': 'Năm ngoái quý vị khấu trừ tiền đóng vào IRA.',
    'reason.hsa': 'Năm ngoái quý vị đã nộp Mẫu {code} cho tài khoản HSA.',
    'reason.hsaSpend': 'Cần nếu năm nay quý vị có rút tiền từ HSA.',
    'reason.energy': 'Năm ngoái quý vị xin tín thuế tiết kiệm năng lượng cho nhà ở.',
    'reason.educator': 'Năm ngoái quý vị khấu trừ chi phí của nhà giáo.',
    'reason.marketplace':
      'Năm ngoái quý vị có bảo hiểm mua qua Marketplace. Thiếu Mẫu {code} là IRS bác tờ khai ngay.',

    'reason.estimatesTotal':
      'Năm ngoái quý vị đóng thuế tạm tính tổng cộng {amount}. Chúng tôi cần đúng ngày và số tiền của từng lần.',
    'reason.estimates':
      'Năm ngoái quý vị có đóng thuế tạm tính. Chúng tôi cần đúng ngày và số tiền của từng lần.',
    'reason.bankInfo':
      'Để tiền hoàn thuế vào thẳng tài khoản của quý vị thay vì gửi chi phiếu giấy.',
    'reason.refundDeposit': 'Để tiền hoàn thuế vào thẳng tài khoản của quý vị.',

    'reason.crypto':
      'Năm ngoái quý vị trả lời có cho câu hỏi về tài sản số. Xin gửi bản xuất đầy đủ các giao dịch của mọi sàn và mọi ví.',
  },
  docCode: {
    'crypto-report': 'Tiền mã hóa',
    'profit-loss': 'Báo cáo lời lỗ',
    'balance-sheet': 'Bảng cân đối',
    'mileage-log': 'Sổ ghi số dặm',
    'asset-schedule': 'Tài sản mua sắm',
    'home-office': 'Văn phòng tại nhà',
    'bank-statements': 'Sao kê ngân hàng',
    'payroll-summary': 'Bảng lương cả năm',
    'property-tax': 'Thuế nhà đất',
    'rental-summary': 'Thu chi cho thuê',
    'closing-statement': 'Giấy tờ sang tên nhà',
    charitable: 'Biên nhận từ thiện',
    'medical-expenses': 'Chi phí y tế',
    childcare: 'Chi phí giữ trẻ',
    'estimated-payments': 'Thuế đóng trước',
    'k12-educator': 'Chi phí giáo viên',
    'energy-credit': 'Biên nhận tiết kiệm năng lượng',
    'photo-id': 'Giấy tờ tùy thân',
    'ssn-card': 'Thẻ an sinh xã hội',
    'voided-check': 'Thông tin ngân hàng',
    'prior-return': 'Tờ khai năm ngoái',
    'engagement-letter': 'Thư thỏa thuận dịch vụ',
    organizer: 'Bảng câu hỏi khai thuế',
    other: 'Giấy tờ khác',
  },
};
