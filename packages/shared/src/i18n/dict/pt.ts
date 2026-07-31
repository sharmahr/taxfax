/**
 * Portuguese. Schedule LEP code 008.
 *
 * Written in Brazilian Portuguese, because that is who is filing: the US
 * Portuguese-speaking taxpayer population is overwhelmingly Brazilian
 * (Massachusetts, Connecticut, South Florida). Continental Portuguese speakers
 * read pt-BR without friction; the reverse is less true, and "declaração de
 * imposto de renda" is the phrase people recognize.
 */

import type { Dictionary } from '../types.ts';

export const pt: Dictionary = {
  locale: 'pt',
  review: 'machine',
  plural: {
    item: { one: 'item', other: 'itens' },
    document: { one: 'documento', other: 'documentos' },
    day: { one: 'dia', other: 'dias' },
  },
  chase: {
    warm: {
      subject: 'Sua lista de documentos para {firmName} está pronta',
      body: [
        'Olá {clientFirstName},',
        'Montamos a lista de documentos da sua declaração deste ano. São {totalCount} {totalCount#item}, tirados da sua declaração do ano passado — ou seja, nada na lista que você não precise de fato.',
        '{bullets}',
        'Você pode enviar tudo direto do celular. Foto serve — nós endireitamos e renomeamos os arquivos.',
        '{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}: {clientFirstName}, ainda faltam {topList}. Envie: {portalUrl} — STOP para sair.',
    },
    neutral: {
      subject: 'Faltam {outstandingCount} {outstandingCount#document} na sua declaração',
      body: ['Olá {clientFirstName},', '{lede}', '{bullets}', '{portalUrl}', '{signature}'],
      sms: '{firmName}: ainda aguardamos {topList}. {portalUrl} — STOP para sair.',
    },
    firm: {
      subject: 'Ainda faltam: {topList}',
      body: [
        'Olá {clientFirstName},',
        'Já são {daysWaiting} {daysWaiting#day}. Não conseguimos começar sua declaração enquanto não chegarem:',
        '{bullets}',
        'Se algo da lista não se aplica a você este ano, é só responder que retiramos, em vez de continuar cobrando.',
        '{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}: {daysWaiting} dias aguardando {topList}. Não podemos começar. {portalUrl} — STOP.',
    },
    urgent: {
      subject: 'Sua declaração está parada — faltam {outstandingCount} {outstandingCount#item}',
      body: [
        '{clientFirstName},',
        'Só falta isto para concluir sua declaração, e ainda aguardamos {outstandingCount} {outstandingCount#document}:',
        '{bullets}',
        '{deadline}',
        'Envie por aqui — leva uns dois minutos:\n{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}: faltam {outstandingCount} documentos e {daysToDeadline} dias de prazo. {topList}. {portalUrl} — STOP.',
    },
    final: {
      subject: 'Provável prorrogação — último aviso sobre seus documentos',
      body: [
        '{clientFirstName},',
        'Este é nosso último aviso automático. Ainda não recebemos:',
        '{bullets}',
        'Se não chegarem nos próximos dias, vamos pedir prorrogação e retomar depois. A prorrogação dá mais prazo para entregar, não para pagar — então juros continuam correndo sobre qualquer saldo devido a partir de {deadlineDate}.',
        '{portalUrl}',
        'Se houver algo travando, responda este e-mail e resolvemos direto com você.',
        '{signature}',
      ],
      sms: '{firmName}: último aviso. Sem {topList} pediremos prorrogação. {portalUrl} — STOP.',
    },
  },
  s: {
    'list.fallback': 'alguns documentos',
    'list.plus': ' e mais {restCount}',
    'bullet.more': '  …e mais {restCount}',
    'neutral.ledeSome':
      'Obrigado — já recebemos {doneCount} de {totalCount}. Ainda aguardamos {outstandingCount}:',
    'neutral.ledeNone': 'Ainda aguardamos todos os {outstandingCount} {outstandingCount#item}:',
    'urgent.deadlineNear':
      'Faltam {daysToDeadline} dias para o prazo de entrega. Depois disso teremos de pedir prorrogação, e ela não adia a data de pagamento.',
    'urgent.deadlineFar': 'Quanto mais demora, maior a chance de isso virar uma prorrogação.',
    'item.fromIssuer': '{code} de {issuers}',

    'portal.title': 'Seus documentos para {firmName}',
    'portal.progress': '{receivedCount} de {totalCount} recebidos',
    'portal.needed': 'Ainda falta',
    'portal.upload': 'Enviar',
    'portal.uploadHint': 'Foto do celular serve — nós endireitamos e renomeamos.',
    'portal.allDone': 'É isso. Nada mais a enviar.',
    'portal.whyAsked': 'Por que pedimos isto',
    'portal.help': 'Travou em algo? Responda qualquer e-mail nosso e alguém entra em contato.',
    'portal.language': 'Idioma',
    'portal.languageHint': 'Escolha o idioma em que falamos com você.',
    'portal.loadFailed': 'Não conseguimos carregar sua lista',
    'portal.loadFailedHint':
      'Verifique sua conexão e recarregue a página. Nada do que você enviou se perdeu.',
    'portal.emptyTitle': 'Nada pendente por enquanto',
    'portal.emptyHint': 'Quando {firmName} precisar de um documento seu, ele aparece aqui.',
    'portal.somethingElse': 'Mais alguma coisa?',

    'upload.gotItIssuer': 'Pronto! {code} de {issuer}.',
    'upload.gotItCode': 'Pronto! {code}.',
    'upload.gotItSaved': 'Pronto! Guardamos no seu arquivo.',
    'upload.preparing': 'Preparando',
    'upload.failed': 'Esse envio não foi concluído.',
    'upload.unreadable': 'Não conseguimos ler esse. Tente uma foto mais nítida.',
    'upload.undo': 'Desfazer',
    'upload.undoLabel': 'Desfazer — remover {name}',
    'upload.removing': 'Removendo…',
    'upload.removingLabel': 'Removendo {name}',

    'signin.working': 'Entrando com segurança…',
    'signin.confirmTitle': 'Confirme seu e-mail',
    'signin.confirmBody':
      'Este link não veio com seu e-mail, então precisamos dele uma vez para confirmar que é você. Digite o endereço para onde seu contador enviou — é a única coisa que conferimos, sem senha.',
    'signin.emailLabel': 'E-mail',
    'signin.continue': 'Continuar',
    'signin.expiredTitle': 'Vamos te mandar um link novo',
    'signin.expiredBody':
      'Este link seguro expirou ou já foi usado. Podemos enviar um novo.',
    'signin.expiredShort': 'Este link seguro expirou.',
    'signin.yourEmail': 'Seu e-mail',
    'signin.sendLink': 'Me envie um link novo',
    'signin.sentTitle': 'Confira seu e-mail',
    'signin.sentBody':
      'Enviamos um link seguro para {email}. Abra neste mesmo aparelho e pronto — sem senha para lembrar.',

    'status.pending': 'Necessário',
    'status.received': 'Recebido',
    'status.accepted': 'Aceito',
    'status.rejected': 'Precisa de outra cópia',
    'status.waived': 'Não é necessário',
    'portal.done': 'Pronto · {doneCount}',
    'portal.uploadedCount': '{uploadedCount} de {expectedCount} enviados',
    'portal.private': 'Privado',
    'portal.needsAnotherTry': 'Precisa de outra tentativa: {detail}',
    'portal.yourAccountant': 'seu contador',
    'portal.somethingElseHint':
      'Tem um documento que não está na lista? Envie aqui que {firmName} resolve.',

    'upload.percent': '{percent}%',
    'upload.tryAgain': 'Tentar de novo',
    'upload.remove': 'Remover',
    'upload.cancel': 'Cancelar',
    'upload.chooseFiles': 'Escolher dos seus arquivos',
    'upload.dropPrompt': 'Arraste uma foto ou um {format} aqui, ou',
    'upload.chooseFile': 'escolha um arquivo',
    'upload.unsupported': 'Esse tipo de arquivo não serve. Tire uma foto ou envie um {format}.',
    'upload.empty': 'Esse arquivo parece vazio. Tente outro.',
    'upload.tooLarge': 'Esse arquivo é grande demais — o limite é {limit}.',
    'upload.photoTooLarge': 'Essa foto é grande demais — o limite é {limit}.',
    'upload.heicUnreadable':
      'Não conseguimos ler essa foto neste aparelho. Tire de novo ou envie um {format}.',
    'upload.heicFailed': 'Não conseguimos processar essa foto. Tente um {format}.',
  },
  reason: {
    'reason.engagement': 'Precisamos disto antes de começar o trabalho.',
    'reason.photoId': 'Serve para conferir sua identidade na transmissão eletrônica.',
    'reason.photoIdBoth':
      'Os dois cônjuges precisam de documento com foto dentro da validade para transmitir.',
    'reason.ipPin':
      'Você usou um PIN de Proteção de Identidade do IRS na declaração de {year}. O IRS emite um novo todo mês de dezembro.',
    'reason.priorReturn':
      'Envie a declaração completa do ano passado e montamos o resto desta lista sozinhos.',

    'reason.w2Issuers': 'No ano passado você teve {count} {code} — de {issuers}.',
    'reason.w2IssuersMany': 'No ano passado você teve {count} {code} — de {issuers}.',
    'reason.w2Wages': 'Sua declaração de {year} informou {amount} de salários.',
    'reason.w2Each': 'Um de cada empregador.',

    'reason.interestIssuers': 'No ano passado você recebeu juros de {issuers}.',
    'reason.interestAmount': 'Sua declaração de {year} informou {amount} de renda de juros.',
    'reason.dividendsIssuers': 'No ano passado você recebeu dividendos de {issuers}.',
    'reason.dividendsAmount': 'Sua declaração de {year} informou {amount} de dividendos.',
    'reason.brokerIssuers':
      'No ano passado você entregou o {code} com movimentação em {issuers}. Precisamos do extrato consolidado completo, com as páginas de custo de aquisição.',
    'reason.brokerSchedule':
      'No ano passado você entregou o {code}, então precisamos do {code2} consolidado da sua corretora — com o detalhe do custo de aquisição.',

    'reason.retirement':
      'Sua declaração de {year} informou {amount} vindos de IRA, pensão ou anuidade.',
    'reason.socialSecurity': 'No ano passado você informou {amount} de benefícios do Seguro Social.',
    'reason.unemployment':
      'No ano passado houve seguro-desemprego ou restituição estadual informada.',

    'reason.scheduleCMany':
      'No ano passado você entregou {count} {code} — um demonstrativo de resultado por negócio.',
    'reason.scheduleCIncome':
      'No ano passado você entregou o {code} com {amount} de lucro líquido do negócio. Um demonstrativo do ano inteiro é o caminho mais rápido.',
    'reason.scheduleC':
      'No ano passado você entregou o {code}. Um demonstrativo do ano inteiro é o caminho mais rápido.',
    'reason.necIssuers': 'No ano passado você recebeu {code} de {issuers}.',
    'reason.necSelfEmployed':
      'No ano passado você informou renda de trabalho autônomo — envie qualquer {code} que chegar.',
    'reason.paymentAppIssuers':
      'No ano passado você recebeu um {code} de {issuers}. O limite de declaração só cai, então espere outro.',
    'reason.paymentApp':
      'No ano passado você recebeu um {code}. O limite de declaração só cai, então espere outro.',
    'reason.mileage':
      'No ano passado você deduziu despesas de veículo. O IRS exige registro de quilometragem feito na hora, então envie seu caderno ou a exportação do aplicativo.',
    'reason.homeOffice':
      'No ano passado você deduziu escritório em casa — precisamos da metragem deste ano, mais contas de consumo, aluguel ou juros do financiamento, e seguro.',
    'reason.assets':
      'Envie as notas de tudo que o negócio comprou acima de $2,500 — equipamentos, veículos ou benfeitorias.',
    'reason.payroll':
      'Os relatórios de folha de fim de ano ({codes}) conferem os salários informados na declaração.',
    'reason.bankStatements':
      'No ano passado houve renda do negócio, mas não há arquivo de contabilidade. Com doze meses de extratos montamos o demonstrativo para você.',

    'reason.k1PartnershipIssuers':
      'Você tem participação em {issuers}. Os {code} de sociedades costumam chegar atrasados — envie cada um assim que receber.',
    'reason.k1Partnership': 'No ano passado você recebeu {count} {code} de sociedade.',
    'reason.k1PartnershipMany': 'No ano passado você recebeu {count} {code} de sociedades.',
    'reason.k1SCorpIssuers': 'Você é acionista de {issuers}.',
    'reason.k1SCorp': 'No ano passado você recebeu {count} {code} de sociedade S.',
    'reason.k1SCorpMany': 'No ano passado você recebeu {count} {code} de sociedades S.',
    'reason.k1Trust': 'No ano passado você foi beneficiário de um trust ou espólio.',

    'reason.rentalMany':
      'O {code} mostrou {count} imóveis alugados no ano passado — envie receitas e despesas de cada um.',
    'reason.rentalOne':
      'No ano passado você entregou o {code}. Envie o aluguel recebido no ano inteiro e as despesas do imóvel.',
    'reason.mortgageIssuers': 'No ano passado você pagou juros de financiamento a {issuers}.',
    'reason.mortgage': 'No ano passado você deduziu juros de financiamento imobiliário.',
    'reason.propertyTax': 'No ano passado você deduziu imposto sobre imóveis.',
    'reason.closing': 'Só se você comprou, vendeu ou refinanciou um imóvel neste ano.',

    'reason.charitableGave':
      'No ano passado você usou deduções detalhadas e doou {amount}. Acima de $250 é preciso um recibo por escrito da instituição.',
    'reason.charitable':
      'No ano passado você usou deduções detalhadas. Acima de $250 é preciso um recibo por escrito da instituição.',
    'reason.medical': 'No ano passado você lançou {amount} de despesas médicas.',
    'reason.studentLoan': 'No ano passado você deduziu juros de crédito estudantil.',
    'reason.education': 'No ano passado você usou um crédito de educação.',
    'reason.childcare':
      'No ano passado você usou o crédito de creche e dependentes. Precisamos do nome, do endereço e do número fiscal do prestador — não só do valor.',
    'reason.ira': 'No ano passado você deduziu uma contribuição para IRA.',
    'reason.hsa': 'No ano passado você entregou o Formulário {code} por causa de uma HSA.',
    'reason.hsaSpend': 'Precisamos se você gastou da sua HSA neste ano.',
    'reason.energy': 'No ano passado você usou um crédito de eficiência energética da casa.',
    'reason.educator': 'No ano passado você usou a dedução de despesas de professor.',
    'reason.marketplace':
      'No ano passado você teve plano do Marketplace. Sem o Formulário {code} o IRS rejeita a declaração na hora.',

    'reason.estimatesTotal':
      'No ano passado você fez pagamentos estimados somando {amount}. Precisamos da data e do valor exatos de cada um.',
    'reason.estimates':
      'No ano passado você fez pagamentos estimados. Precisamos da data e do valor exatos de cada um.',
    'reason.bankInfo':
      'Para que qualquer restituição caia direto na sua conta em vez de virar cheque em papel.',
    'reason.refundDeposit': 'Para que a restituição caia direto na sua conta.',

    'reason.crypto':
      'No ano passado você respondeu sim à pergunta sobre ativos digitais. Envie a exportação completa das transações de cada corretora e carteira.',
  },
  docCode: {
    'crypto-report': 'Criptomoedas',
    'profit-loss': 'Demonstração de resultados',
    'balance-sheet': 'Balanço patrimonial',
    'mileage-log': 'Registro de quilometragem',
    'asset-schedule': 'Bens adquiridos',
    'home-office': 'Escritório em casa',
    'bank-statements': 'Extratos bancários',
    'payroll-summary': 'Resumo da folha de pagamento',
    'property-tax': 'IPTU (property tax)',
    'rental-summary': 'Receitas e despesas de aluguel',
    'closing-statement': 'Escritura de compra e venda',
    charitable: 'Recibos de doação',
    'medical-expenses': 'Despesas médicas',
    childcare: 'Creche e cuidados infantis',
    'estimated-payments': 'Pagamentos estimados',
    'k12-educator': 'Despesas de professor',
    'energy-credit': 'Recibos de eficiência energética',
    'photo-id': 'Documento com foto',
    'ssn-card': 'Cartão do Social Security',
    'voided-check': 'Dados bancários',
    'prior-return': 'Declaração do ano passado',
    'engagement-letter': 'Contrato de prestação de serviços',
    organizer: 'Questionário fiscal',
    other: 'Outro documento',
  },
};
