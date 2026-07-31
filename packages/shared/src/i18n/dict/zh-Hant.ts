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
    'portal.done': '已完成 · {doneCount}',
    'portal.uploadedCount': '已上傳 {expectedCount} 份中的 {uploadedCount} 份',
    'portal.private': '私密',
    'portal.needsAnotherTry': '需要重新上傳：{detail}',
    'portal.yourAccountant': '您的會計師',
    'portal.somethingElseHint': '有清單上沒有的資料？在這裡上傳，{firmName} 會處理。',

    'upload.percent': '{percent}%',
    'upload.tryAgain': '重試',
    'upload.remove': '移除',
    'upload.cancel': '取消',
    'upload.chooseFiles': '從您的檔案中選擇',
    'upload.dropPrompt': '把照片或 {format} 拖到這裡，或',
    'upload.chooseFile': '選擇檔案',
    'upload.unsupported': '這種檔案格式不支援。請拍張照片，或上傳 {format}。',
    'upload.empty': '這個檔案是空的，請換一個。',
    'upload.tooLarge': '這個檔案太大了，上限是 {limit}。',
    'upload.photoTooLarge': '這張照片太大了，上限是 {limit}。',
    'upload.heicUnreadable': '這台裝置讀不了這張照片。請重拍一張，或上傳 {format}。',
    'upload.heicFailed': '這張照片處理不了。請改用 {format}。',
  },
  reason: {
    'reason.engagement': '我們開始辦理之前必須先拿到這份文件。',
    'reason.photoId': '電子申報時需要用它核對您的身分。',
    'reason.photoIdBoth': '電子申報時夫妻雙方都需要在有效期內的附照片證件。',
    'reason.ipPin':
      '您在 {year} 年度的報稅表上用了國稅局身分保護 PIN 碼。國稅局每年 12 月都會重新發一組。',
    'reason.priorReturn': '請上傳去年完整的報稅表，我們會據此自動補齊這份清單的其餘部分。',

    'reason.w2Issuers': '您去年有 {count} 份 {code}，來自 {issuers}。',
    'reason.w2IssuersMany': '您去年有 {count} 份 {code}，來自 {issuers}。',
    'reason.w2Wages': '您 {year} 年度的報稅表申報了 {amount} 的薪資。',
    'reason.w2Each': '每位雇主一份。',

    'reason.interestIssuers': '您去年有來自 {issuers} 的利息。',
    'reason.interestAmount': '您 {year} 年度的報稅表申報了 {amount} 的利息收入。',
    'reason.dividendsIssuers': '您去年有來自 {issuers} 的股利。',
    'reason.dividendsAmount': '您 {year} 年度的報稅表申報了 {amount} 的股利。',
    'reason.brokerIssuers':
      '您去年報了 {code}，在 {issuers} 有交易。我們需要完整的合併對帳單，包括成本基礎那幾頁。',
    'reason.brokerSchedule':
      '您去年報了 {code}，所以我們需要券商出具的合併 {code2}，含成本基礎明細。',

    'reason.retirement': '您 {year} 年度的報稅表申報了 {amount} 的 IRA、退休金或年金收入。',
    'reason.socialSecurity': '您去年申報了 {amount} 的社會安全福利金。',
    'reason.unemployment': '您去年申報過失業金或州稅退稅。',

    'reason.scheduleCMany': '您去年報了 {count} 份 {code}，每項生意各需一份損益表。',
    'reason.scheduleCIncome':
      '您去年報了 {code}，營業淨收入 {amount}。整年的損益表是最快能辦完的方式。',
    'reason.scheduleC': '您去年報了 {code}。整年的損益表是最快能辦完的方式。',
    'reason.necIssuers': '您去年收到來自 {issuers} 的 {code}。',
    'reason.necSelfEmployed': '您去年申報過自僱收入，收到的 {code} 請一併上傳。',
    'reason.paymentAppIssuers':
      '您去年收到來自 {issuers} 的 {code}。申報門檻一直在降，今年多半還會有。',
    'reason.paymentApp': '您去年收到過 {code}。申報門檻一直在降，今年多半還會有。',
    'reason.mileage':
      '您去年申報了車輛費用。國稅局要求當時就記下的里程記錄，請上傳行車本或應用程式匯出的記錄。',
    'reason.homeOffice':
      '您去年申報了家庭辦公室扣除，我們需要今年的坪數，以及水電費、房租或房貸利息和保險費。',
    'reason.assets': '生意上超過 $2,500 的採購都請上傳發票——設備、車輛或裝修改良。',
    'reason.payroll': '年終薪資報表（{codes}）用來核對報稅表上的薪資。',
    'reason.bankStatements':
      '您去年有營業收入，但沒有記帳檔案。有十二個月的對帳單，我們就能替您編出損益表。',

    'reason.k1PartnershipIssuers':
      '您持有 {issuers} 的權益。合夥企業的 {code} 常常來得晚，收到一份就上傳一份。',
    'reason.k1Partnership': '您去年收到 {count} 份合夥企業的 {code}。',
    'reason.k1PartnershipMany': '您去年收到 {count} 份合夥企業的 {code}。',
    'reason.k1SCorpIssuers': '您是 {issuers} 的股東。',
    'reason.k1SCorp': '您去年收到 {count} 份 S 類公司的 {code}。',
    'reason.k1SCorpMany': '您去年收到 {count} 份 S 類公司的 {code}。',
    'reason.k1Trust': '您去年是某個信託或遺產的受益人。',

    'reason.rentalMany': '{code} 顯示您去年有 {count} 處出租房，每處的收入和支出都請提供。',
    'reason.rentalOne': '您去年報了 {code}。請提供該房產整年收到的租金以及各項支出。',
    'reason.mortgageIssuers': '您去年向 {issuers} 支付了房貸利息。',
    'reason.mortgage': '您去年扣除過房貸利息。',
    'reason.propertyTax': '您去年扣除過房地產稅。',
    'reason.closing': '只有今年買賣或重貸過房產才需要。',

    'reason.charitableGave':
      '您去年選擇了列舉扣除，捐了 {amount}。超過 $250 的捐款需要慈善機構出具的書面證明。',
    'reason.charitable':
      '您去年選擇了列舉扣除。超過 $250 的捐款需要慈善機構出具的書面證明。',
    'reason.medical': '您去年申報了 {amount} 的醫療費用。',
    'reason.studentLoan': '您去年扣除過助學貸款利息。',
    'reason.education': '您去年申請過教育抵稅額。',
    'reason.childcare':
      '您去年申請了子女及受扶養人照顧抵稅額。我們需要托育機構的名稱、地址和稅號，光有金額不夠。',
    'reason.ira': '您去年扣除過 IRA 供款。',
    'reason.hsa': '您去年為健康儲蓄帳戶報了 {code} 表。',
    'reason.hsaSpend': '今年如果從健康儲蓄帳戶裡支出過就需要。',
    'reason.energy': '您去年申請過住宅節能抵稅額。',
    'reason.educator': '您去年申報過教師費用扣除。',
    'reason.marketplace':
      '您去年參加了健保市場的保險。沒有 {code} 表，國稅局會直接退回報稅表。',

    'reason.estimatesTotal': '您去年預繳了總共 {amount} 的稅款。每一筆的準確日期和金額都需要。',
    'reason.estimates': '您去年預繳過稅款。每一筆的準確日期和金額都需要。',
    'reason.bankInfo': '這樣退稅會直接匯進您的帳戶，不用等紙本支票。',
    'reason.refundDeposit': '這樣退稅會直接匯進您的帳戶。',

    'reason.crypto': '您去年在數位資產那一題回答了「是」。請提供每個交易所和錢包的完整交易記錄。',
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
