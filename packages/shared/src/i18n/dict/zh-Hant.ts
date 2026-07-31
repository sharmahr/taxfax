/**
 * Chinese (Traditional). IRS Publication 17 language.
 *
 * Taiwan/Hong Kong conventions — 繁體字 and the vocabulary that goes with them
 * (報稅 not 报税, 帳單 not 账单). Not a character-by-character conversion of the
 * Simplified file: 資料 vs 材料 and similar choices differ, which is precisely
 * why the IRS treats these as two languages and gives them two Schedule LEP
 * codes (019 and 020).
 */

import type { Dictionary } from '../types.ts';

export const zhHant: Dictionary = {
  locale: 'zh-Hant',
  review: 'machine',
  plural: {
    item: { other: '項' },
    document: { other: '份文件' },
    day: { other: '天' },
  },
  chase: {
    warm: {
      subject: '{firmName} 已為您備妥報稅資料清單',
      body: [
        '{clientFirstName} 您好：',
        '我們已依照您去年的報稅表，整理出今年報稅所需的資料清單，共 {totalCount} {totalCount#item}。清單上的每一項都是確實需要的。',
        '{bullets}',
        '用手機直接上傳即可，拍照就好，我們會自動擺正並重新命名。',
        '{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}：{clientFirstName} 您好，報稅還缺 {topList}。兩分鐘上傳：{portalUrl}。回覆STOP退訂。',
    },
    neutral: {
      subject: '您的報稅還缺 {outstandingCount} {outstandingCount#document}',
      body: ['{clientFirstName} 您好：', '{lede}', '{bullets}', '{portalUrl}', '{signature}'],
      sms: '{firmName}：仍在等 {topList}。上傳：{portalUrl}。回覆STOP退訂。',
    },
    firm: {
      subject: '仍需提供：{topList}',
      body: [
        '{clientFirstName} 您好：',
        '已經等了 {daysWaiting} {daysWaiting#day}。以下資料到齊之前，我們無法開始為您報稅：',
        '{bullets}',
        '如果清單上有哪一項今年用不到，請回覆告訴我們，我們會直接刪除，不再重複詢問。',
        '{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}：已等 {daysWaiting} 天，仍缺 {topList}，報稅無法開始。{portalUrl}。回覆STOP退訂。',
    },
    urgent: {
      subject: '您的報稅已暫停 — 尚缺 {outstandingCount} {outstandingCount#item}',
      body: [
        '{clientFirstName} 您好：',
        '現在只差這一步就能完成您的報稅，我們還在等 {outstandingCount} {outstandingCount#document}：',
        '{bullets}',
        '{deadline}',
        '在這裡上傳，大約兩分鐘：\n{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}：尚缺 {outstandingCount} 份文件，距截止日 {daysToDeadline} 天。{topList}。{portalUrl}。回覆STOP退訂。',
    },
    final: {
      subject: '可能需要延期申報 — 資料最後提醒',
      body: [
        '{clientFirstName} 您好：',
        '這是我們最後一次自動提醒。以下資料仍未收到：',
        '{bullets}',
        '若這幾天內仍未送達，我們會先為您申請延期，之後再繼續處理。延期只延長報稅時間，不延長繳稅時間，應繳稅款自 {deadlineDate} 起仍會計算利息。',
        '{portalUrl}',
        '如果有什麼難處，直接回覆這封郵件，我們會協助您處理。',
        '{signature}',
      ],
      sms: '{firmName}：最後提醒。若無 {topList}，我們將申請延期。{portalUrl}。回覆STOP退訂。',
    },
  },
  s: {
    'list.fallback': '幾份文件',
    'list.plus': '，另有 {restCount} 項',
    'bullet.more': '  …另有 {restCount} 項',
    'neutral.ledeSome':
      '謝謝，我們已收到 {totalCount} 項中的 {doneCount} 項，還缺 {outstandingCount} 項：',
    'neutral.ledeNone': '我們還在等這 {outstandingCount} {outstandingCount#item}：',
    'urgent.deadlineNear':
      '距離申報截止日還有 {daysToDeadline} 天。逾期我們就必須申請延期，而延期並不延後繳稅期限。',
    'urgent.deadlineFar': '拖得越久，最後越可能要申請延期。',
    'item.fromIssuer': '{issuers} 的 {code}',

    'portal.title': '您在 {firmName} 的報稅資料',
    'portal.progress': '已收到 {totalCount} 項中的 {receivedCount} 項',
    'portal.needed': '仍需提供',
    'portal.upload': '上傳',
    'portal.uploadHint': '用手機拍照就可以，我們會自動擺正並重新命名。',
    'portal.allDone': '全部齊了，不需要再上傳任何資料。',
    'portal.whyAsked': '為什麼需要這份資料',
    'portal.help': '遇到問題？回覆我們任何一封郵件，會有專人回覆您。',
    'portal.language': '語言',
    'portal.languageHint': '變更我們與您聯絡時使用的語言。',
    'portal.loadFailed': '無法載入您的清單',
    'portal.loadFailedHint':
      '請檢查網路連線後重新載入頁面。您已上傳的資料不會遺失。',
    'portal.emptyTitle': '目前沒有需要提供的資料',
    'portal.emptyHint': '{firmName} 需要您提供資料時，會顯示在這裡。',
    'portal.somethingElse': '還有別的嗎？',

    'upload.gotItIssuer': '收到！{issuer} 的 {code}。',
    'upload.gotItCode': '收到！{code}。',
    'upload.gotItSaved': '收到！已存入您的檔案。',
    'upload.preparing': '準備中',
    'upload.failed': '這份沒有上傳成功。',
    'upload.unreadable': '這份看不清楚，請重拍一張更清晰的照片。',
    'upload.undo': '復原',
    'upload.undoLabel': '復原 — 移除 {name}',
    'upload.removing': '正在移除…',
    'upload.removingLabel': '正在移除 {name}',

    'signin.working': '正在為您安全登入…',
    'signin.confirmTitle': '確認您的電子郵件',
    'signin.confirmBody':
      '這個連結沒有帶上您的電子郵件地址，需要您填寫一次以確認身分。請輸入會計師寄送此連結時使用的地址——我們只核對這一項，不需要密碼。',
    'signin.emailLabel': '電子郵件地址',
    'signin.continue': '繼續',
    'signin.expiredTitle': '幫您換一個新連結',
    'signin.expiredBody':
      '這個安全連結已過期或已被使用過。我們可以寄一個新的給您。',
    'signin.expiredShort': '這個安全連結已過期。',
    'signin.yourEmail': '您的電子郵件地址',
    'signin.sendLink': '寄新連結給我',
    'signin.sentTitle': '請查看您的電子郵件',
    'signin.sentBody':
      '我們已將安全連結寄到 {email}。請在這台裝置上開啟即可登入，不必記任何密碼。',

    'status.pending': '待提供',
    'status.received': '已收到',
    'status.accepted': '已通過',
    'status.rejected': '需要重新上傳',
    'status.waived': '無需提供',
  },
  docCode: {
    'crypto-report': '加密資產紀錄',
    'profit-loss': '損益表',
    'balance-sheet': '資產負債表',
    'mileage-log': '行車里程紀錄',
    'asset-schedule': '資產購置明細',
    'home-office': '家庭辦公室',
    'bank-statements': '銀行對帳單',
    'payroll-summary': '薪資彙總',
    'property-tax': '房屋稅單',
    'rental-summary': '出租房收支',
    'closing-statement': '過戶結算單',
    charitable: '捐款收據',
    'medical-expenses': '醫療費用',
    childcare: '托兒費用',
    'estimated-payments': '預繳稅款',
    'k12-educator': '教師支出',
    'energy-credit': '節能改造收據',
    'photo-id': '身分證件',
    'ssn-card': '社安卡',
    'voided-check': '銀行帳戶資料',
    'prior-return': '去年報稅表',
    'engagement-letter': '業務委任書',
    organizer: '報稅問卷',
    other: '其他文件',
  },
};
