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
