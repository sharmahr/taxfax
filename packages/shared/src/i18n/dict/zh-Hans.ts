/**
 * Chinese (Simplified). IRS Publication 17 language.
 *
 * Mainland/Singapore conventions: 简体字, full-width punctuation, 您 throughout
 * (the polite second person is not optional in professional correspondence).
 * Every SMS is UCS-2 at 70 characters a segment, but Chinese is dense enough
 * that the copy still fits where an alphabetic language would not.
 */

import type { Dictionary } from '../types.ts';

export const zhHans: Dictionary = {
  locale: 'zh-Hans',
  review: 'machine',
  plural: {
    // Chinese has a single grammatical form; CLDR reports `other` for every count.
    item: { other: '项' },
    document: { other: '份文件' },
    day: { other: '天' },
  },
  chase: {
    warm: {
      subject: '{firmName} 已为您准备好报税资料清单',
      body: [
        '{clientFirstName} 您好：',
        '我们已根据您去年的报税表，整理出今年报税所需的资料清单，共 {totalCount} {totalCount#item}。清单上的每一项都是确实需要的。',
        '{bullets}',
        '用手机直接上传即可，拍照就行，我们会自动摆正并重新命名。',
        '{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}：{clientFirstName} 您好，报税还差 {topList}。两分钟上传：{portalUrl}。回复STOP退订。',
    },
    neutral: {
      subject: '您的报税还差 {outstandingCount} {outstandingCount#document}',
      body: ['{clientFirstName} 您好：', '{lede}', '{bullets}', '{portalUrl}', '{signature}'],
      sms: '{firmName}：还在等 {topList}。上传：{portalUrl}。回复STOP退订。',
    },
    firm: {
      subject: '仍需提供：{topList}',
      body: [
        '{clientFirstName} 您好：',
        '已经等了 {daysWaiting} {daysWaiting#day}。以下资料到齐前，我们无法开始为您报税：',
        '{bullets}',
        '如果清单上有哪一项今年用不到，请回复告诉我们，我们会直接删除，不再重复询问。',
        '{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}：已等 {daysWaiting} 天，仍缺 {topList}，报税无法开始。{portalUrl}。回复STOP退订。',
    },
    urgent: {
      subject: '您的报税已暂停 — 尚缺 {outstandingCount} {outstandingCount#item}',
      body: [
        '{clientFirstName} 您好：',
        '现在只差这一步就能完成您的报税，我们还在等 {outstandingCount} {outstandingCount#document}：',
        '{bullets}',
        '{deadline}',
        '在这里上传，大约两分钟：\n{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}：还缺 {outstandingCount} 份文件，距截止日 {daysToDeadline} 天。{topList}。{portalUrl}。回复STOP退订。',
    },
    final: {
      subject: '可能需要延期申报 — 资料最后提醒',
      body: [
        '{clientFirstName} 您好：',
        '这是我们最后一次自动提醒。以下资料仍未收到：',
        '{bullets}',
        '若这几天内仍未送达，我们将先为您申请延期，之后再继续处理。延期只延长报税时间，不延长缴税时间，应缴税款自 {deadlineDate} 起仍会计算利息。',
        '{portalUrl}',
        '如果有什么难处，直接回复这封邮件，我们会协助您处理。',
        '{signature}',
      ],
      sms: '{firmName}：最后提醒。若无 {topList}，我们将申请延期。{portalUrl}。回复STOP退订。',
    },
  },
  s: {
    'list.fallback': '几份文件',
    'list.plus': '，另有 {restCount} 项',
    'bullet.more': '  …另有 {restCount} 项',
    'neutral.ledeSome':
      '谢谢，我们已收到 {totalCount} 项中的 {doneCount} 项，还差 {outstandingCount} 项：',
    'neutral.ledeNone': '我们还在等这 {outstandingCount} {outstandingCount#item}：',
    'urgent.deadlineNear':
      '距离申报截止日还有 {daysToDeadline} 天。逾期我们就必须申请延期，而延期并不延后缴税期限。',
    'urgent.deadlineFar': '拖得越久，最后越可能要申请延期。',
    'item.fromIssuer': '{issuers} 的 {code}',

    'portal.title': '您在 {firmName} 的报税资料',
    'portal.progress': '已收到 {totalCount} 项中的 {receivedCount} 项',
    'portal.needed': '仍需提供',
    'portal.upload': '上传',
    'portal.uploadHint': '用手机拍照就可以，我们会自动摆正并重新命名。',
    'portal.allDone': '全部齐了，不需要再上传任何资料。',
    'portal.whyAsked': '为什么需要这份资料',
    'portal.help': '遇到问题？回复我们任何一封邮件，会有专人回复您。',
    'portal.language': '语言',
    'portal.languageHint': '更改我们与您联系时使用的语言。',
    'portal.loadFailed': '无法载入您的清单',
    'portal.loadFailedHint':
      '请检查网络连接后重新载入页面。您已上传的资料不会丢失。',
    'portal.emptyTitle': '目前没有需要提供的资料',
    'portal.emptyHint': '{firmName} 需要您提供资料时，会显示在这里。',
    'portal.somethingElse': '还有别的吗？',

    'upload.gotItIssuer': '收到！{issuer} 的 {code}。',
    'upload.gotItCode': '收到！{code}。',
    'upload.gotItSaved': '收到！已存入您的档案。',
    'upload.preparing': '准备中',
    'upload.failed': '这份没有上传成功。',
    'upload.unreadable': '这份看不清楚，请重拍一张更清晰的照片。',
    'upload.undo': '撤销',
    'upload.undoLabel': '撤销 — 移除 {name}',
    'upload.removing': '正在移除…',
    'upload.removingLabel': '正在移除 {name}',

    'signin.working': '正在为您安全登录…',
    'signin.confirmTitle': '确认您的邮箱',
    'signin.confirmBody':
      '这个链接没有带上您的邮箱地址，需要您填写一次以确认身份。请输入会计师发送此链接时使用的邮箱地址——我们只核对这一项，不需要密码。',
    'signin.emailLabel': '邮箱地址',
    'signin.continue': '继续',
    'signin.expiredTitle': '给您换一个新链接',
    'signin.expiredBody':
      '这个安全链接已过期或已被使用过。我们可以给您发一个新的。',
    'signin.expiredShort': '这个安全链接已过期。',
    'signin.yourEmail': '您的邮箱地址',
    'signin.sendLink': '给我发送新链接',
    'signin.sentTitle': '请查收邮件',
    'signin.sentBody':
      '我们已将安全链接发送至 {email}。请在本设备上打开即可登录，无需记住任何密码。',

    'status.pending': '待提供',
    'status.received': '已收到',
    'status.accepted': '已通过',
    'status.rejected': '需要重新上传',
    'status.waived': '无需提供',
    'portal.done': '已完成 · {doneCount}',
    'portal.uploadedCount': '已上传 {expectedCount} 份中的 {uploadedCount} 份',
    'portal.private': '私密',
    'portal.needsAnotherTry': '需要重新上传：{detail}',
    'portal.yourAccountant': '您的会计师',
    'portal.somethingElseHint': '有清单上没有的资料？在这里上传，{firmName} 会处理。',

    'upload.percent': '{percent}%',
    'upload.tryAgain': '重试',
    'upload.remove': '移除',
    'upload.cancel': '取消',
    'upload.chooseFiles': '从您的文件中选择',
    'upload.dropPrompt': '把照片或 {format} 拖到这里，或',
    'upload.chooseFile': '选择文件',
    'upload.unsupported': '这种文件格式不支持。请拍张照片，或上传 {format}。',
    'upload.empty': '这个文件是空的，请换一个。',
    'upload.tooLarge': '这个文件太大了，上限是 {limit}。',
    'upload.photoTooLarge': '这张照片太大了，上限是 {limit}。',
    'upload.heicUnreadable': '这台设备读不了这张照片。请重拍一张，或上传 {format}。',
    'upload.heicFailed': '这张照片处理不了。请改用 {format}。',
  },
  reason: {
    'reason.engagement': '我们开始办理之前必须先拿到这份文件。',
    'reason.photoId': '电子申报时需要用它核对您的身份。',
    'reason.photoIdBoth': '电子申报时夫妻双方都需要在有效期内的带照片证件。',
    'reason.ipPin':
      '您在 {year} 年度的报税表上用了国税局身份保护 PIN 码。国税局每年 12 月都会重新发一组。',
    'reason.priorReturn': '请上传去年完整的报税表，我们会据此自动补齐这份清单的其余部分。',

    'reason.w2Issuers': '您去年有 {count} 份 {code}，来自 {issuers}。',
    'reason.w2IssuersMany': '您去年有 {count} 份 {code}，来自 {issuers}。',
    'reason.w2Wages': '您 {year} 年度的报税表申报了 {amount} 的工资。',
    'reason.w2Each': '每位雇主一份。',

    'reason.interestIssuers': '您去年有来自 {issuers} 的利息。',
    'reason.interestAmount': '您 {year} 年度的报税表申报了 {amount} 的利息收入。',
    'reason.dividendsIssuers': '您去年有来自 {issuers} 的股息。',
    'reason.dividendsAmount': '您 {year} 年度的报税表申报了 {amount} 的股息。',
    'reason.brokerIssuers':
      '您去年报了 {code}，在 {issuers} 有交易。我们需要完整的合并对账单，包括成本基础那几页。',
    'reason.brokerSchedule':
      '您去年报了 {code}，所以我们需要券商出具的合并 {code2}，含成本基础明细。',

    'reason.retirement': '您 {year} 年度的报税表申报了 {amount} 的 IRA、退休金或年金收入。',
    'reason.socialSecurity': '您去年申报了 {amount} 的社会安全福利金。',
    'reason.unemployment': '您去年申报过失业金或州税退税。',

    'reason.scheduleCMany': '您去年报了 {count} 份 {code}，每项生意各需一份损益表。',
    'reason.scheduleCIncome':
      '您去年报了 {code}，营业净收入 {amount}。整年的损益表是最快能办完的方式。',
    'reason.scheduleC': '您去年报了 {code}。整年的损益表是最快能办完的方式。',
    'reason.necIssuers': '您去年收到来自 {issuers} 的 {code}。',
    'reason.necSelfEmployed': '您去年申报过自雇收入，收到的 {code} 请一并上传。',
    'reason.paymentAppIssuers':
      '您去年收到来自 {issuers} 的 {code}。申报门槛一直在降，今年多半还会有。',
    'reason.paymentApp': '您去年收到过 {code}。申报门槛一直在降，今年多半还会有。',
    'reason.mileage':
      '您去年申报了车辆费用。国税局要求当时就记下的里程记录，请上传行车本或应用导出的记录。',
    'reason.homeOffice':
      '您去年申报了家庭办公室扣除，我们需要今年的面积，以及水电费、房租或房贷利息和保险费。',
    'reason.assets': '生意上超过 $2,500 的采购都请上传发票——设备、车辆或装修改良。',
    'reason.payroll': '年终薪资报表（{codes}）用来核对报税表上的工资。',
    'reason.bankStatements':
      '您去年有营业收入，但没有记账文件。有十二个月的对账单，我们就能替您编出损益表。',

    'reason.k1PartnershipIssuers':
      '您持有 {issuers} 的权益。合伙企业的 {code} 常常来得晚，收到一份就上传一份。',
    'reason.k1Partnership': '您去年收到 {count} 份合伙企业的 {code}。',
    'reason.k1PartnershipMany': '您去年收到 {count} 份合伙企业的 {code}。',
    'reason.k1SCorpIssuers': '您是 {issuers} 的股东。',
    'reason.k1SCorp': '您去年收到 {count} 份 S 类公司的 {code}。',
    'reason.k1SCorpMany': '您去年收到 {count} 份 S 类公司的 {code}。',
    'reason.k1Trust': '您去年是某个信托或遗产的受益人。',

    'reason.rentalMany': '{code} 显示您去年有 {count} 处出租房，每处的收入和支出都请提供。',
    'reason.rentalOne': '您去年报了 {code}。请提供该房产整年收到的租金以及各项支出。',
    'reason.mortgageIssuers': '您去年向 {issuers} 支付了房贷利息。',
    'reason.mortgage': '您去年扣除过房贷利息。',
    'reason.propertyTax': '您去年扣除过房地产税。',
    'reason.closing': '只有今年买卖或重贷过房产才需要。',

    'reason.charitableGave':
      '您去年选择了列举扣除，捐了 {amount}。超过 $250 的捐款需要慈善机构出具的书面证明。',
    'reason.charitable':
      '您去年选择了列举扣除。超过 $250 的捐款需要慈善机构出具的书面证明。',
    'reason.medical': '您去年申报了 {amount} 的医疗费用。',
    'reason.studentLoan': '您去年扣除过助学贷款利息。',
    'reason.education': '您去年申请过教育抵税额。',
    'reason.childcare':
      '您去年申请了子女及受抚养人照顾抵税额。我们需要托育机构的名称、地址和税号，光有金额不够。',
    'reason.ira': '您去年扣除过 IRA 供款。',
    'reason.hsa': '您去年为健康储蓄账户报了 {code} 表。',
    'reason.hsaSpend': '今年如果从健康储蓄账户里支出过就需要。',
    'reason.energy': '您去年申请过住宅节能抵税额。',
    'reason.educator': '您去年申报过教师费用扣除。',
    'reason.marketplace':
      '您去年参加了健保市场的保险。没有 {code} 表，国税局会直接退回报税表。',

    'reason.estimatesTotal': '您去年预缴了总共 {amount} 的税款。每一笔的准确日期和金额都需要。',
    'reason.estimates': '您去年预缴过税款。每一笔的准确日期和金额都需要。',
    'reason.bankInfo': '这样退税会直接汇进您的账户，不用等纸本支票。',
    'reason.refundDeposit': '这样退税会直接汇进您的账户。',

    'reason.crypto': '您去年在数字资产那一题回答了“是”。请提供每个交易所和钱包的完整交易记录。',
  },
  docCode: {
    'crypto-report': '加密资产记录',
    'profit-loss': '损益表',
    'balance-sheet': '资产负债表',
    'mileage-log': '行车里程记录',
    'asset-schedule': '资产购置明细',
    'home-office': '家庭办公室',
    'bank-statements': '银行对账单',
    'payroll-summary': '工资汇总',
    'property-tax': '房产税单',
    'rental-summary': '出租房收支',
    'closing-statement': '过户结算单',
    charitable: '捐款收据',
    'medical-expenses': '医疗费用',
    childcare: '托儿费用',
    'estimated-payments': '预缴税款',
    'k12-educator': '教师支出',
    'energy-credit': '节能改造收据',
    'photo-id': '身份证件',
    'ssn-card': '社安卡',
    'voided-check': '银行账户信息',
    'prior-return': '去年报税表',
    'engagement-letter': '业务委托书',
    organizer: '报税问卷',
    other: '其他文件',
  },
};
