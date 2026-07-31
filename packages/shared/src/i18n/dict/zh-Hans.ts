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
