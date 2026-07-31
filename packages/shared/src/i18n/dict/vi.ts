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
