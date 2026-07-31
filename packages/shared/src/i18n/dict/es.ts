/**
 * Spanish. IRS Publication 17 language.
 *
 * Usted-form throughout: this is correspondence from an accountant about money
 * owed to the government, and tú would be wrong across most of the US Spanish-
 * speaking population regardless of region.
 *
 * Note for the reviewer: accented vowels (á í ó ú) are outside the GSM-7
 * alphabet, so every Spanish SMS is billed as UCS-2 at 70 characters a segment.
 * The copy below is written short on purpose. Do not "fix" it by stripping
 * accents — that reads illiterate in tax correspondence.
 */

import type { Dictionary } from '../types.ts';

export const es: Dictionary = {
  locale: 'es',
  review: 'machine',
  plural: {
    item: { one: 'documento', other: 'documentos' },
    document: { one: 'documento', other: 'documentos' },
    day: { one: 'día', other: 'días' },
  },
  chase: {
    warm: {
      subject: 'Su lista de documentos de {firmName} ya está lista',
      body: [
        'Hola {clientFirstName}:',
        'Ya preparamos su lista de documentos para la declaración de este año. Son {totalCount} {totalCount#item}, tomados de su declaración del año pasado, así que no le pedimos nada que no necesite de verdad.',
        '{bullets}',
        'Puede subirlos desde el teléfono: las fotos sirven, nosotros las enderezamos y les cambiamos el nombre.',
        '{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}: {clientFirstName}, faltan {topList}. Suba en 2 min: {portalUrl}. STOP para no recibir más.',
    },
    neutral: {
      subject: 'Faltan {outstandingCount} {outstandingCount#document} para su declaración',
      body: ['Hola {clientFirstName}:', '{lede}', '{bullets}', '{portalUrl}', '{signature}'],
      sms: '{firmName}: {clientFirstName}, seguimos esperando {topList}. {portalUrl}. STOP para no recibir más.',
    },
    firm: {
      subject: 'Todavía faltan: {topList}',
      body: [
        'Hola {clientFirstName}:',
        'Han pasado {daysWaiting} {daysWaiting#day}. No podemos empezar su declaración hasta que lleguen estos documentos:',
        '{bullets}',
        'Si algo de esta lista no le corresponde este año, respóndanos y lo quitamos en vez de seguir pidiéndoselo.',
        '{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}: {daysWaiting} días esperando {topList}. No podemos empezar. {portalUrl}. STOP para salir.',
    },
    urgent: {
      subject: 'Su declaración está detenida: faltan {outstandingCount} {outstandingCount#item}',
      body: [
        '{clientFirstName}:',
        'Su declaración es lo único que falta para que quede libre de esto, y está esperando {outstandingCount} {outstandingCount#document}:',
        '{bullets}',
        '{deadline}',
        'Súbalos aquí; se tarda unos dos minutos:\n{portalUrl}',
        '{signature}',
      ],
      sms: '{firmName}: faltan {outstandingCount} documentos y quedan {daysToDeadline} días. {topList}. {portalUrl}. STOP para salir.',
    },
    final: {
      subject: 'Prórroga probable: último aviso para sus documentos',
      body: [
        '{clientFirstName}:',
        'Este es nuestro último recordatorio automático. Todavía no tenemos:',
        '{bullets}',
        'Si no llegan en los próximos días, presentaremos una prórroga y retomaremos su declaración después. Una prórroga da más tiempo para presentar, no para pagar, así que cualquier saldo pendiente sigue generando intereses desde el {deadlineDate}.',
        '{portalUrl}',
        'Si hay algún motivo por el que esté atascado, responda a este correo y lo resolvemos directamente.',
        '{signature}',
      ],
      sms: '{firmName}: último aviso. Sin {topList} pediremos una prórroga. {portalUrl}. STOP para salir.',
    },
  },
  s: {
    'list.fallback': 'algunos documentos',
    'list.plus': ' y {restCount} más',
    'bullet.more': '  …y {restCount} más',
    'neutral.ledeSome':
      'Gracias: ya tenemos {doneCount} de {totalCount}. Seguimos esperando {outstandingCount}:',
    'neutral.ledeNone': 'Seguimos esperando los {outstandingCount} {outstandingCount#item}:',
    'urgent.deadlineNear':
      'Quedan {daysToDeadline} días para la fecha límite. Después tendríamos que presentar una prórroga, que no aplaza la fecha de pago.',
    'urgent.deadlineFar':
      'Cuanto más tiempo pase, más probable es que terminemos presentando una prórroga.',
    'item.fromIssuer': '{code} de {issuers}',

    'portal.title': 'Sus documentos para {firmName}',
    'portal.progress': '{receivedCount} de {totalCount} recibidos',
    'portal.needed': 'Todavía falta',
    'portal.upload': 'Subir',
    'portal.uploadHint':
      'Una foto del teléfono sirve: nosotros la enderezamos y le ponemos nombre.',
    'portal.allDone': 'Eso es todo. No hace falta enviar nada más.',
    'portal.whyAsked': 'Por qué lo necesitamos',
    'portal.help':
      '¿Atascado? Responda a cualquiera de nuestros correos y le contestará una persona.',
    'portal.language': 'Idioma',
    'portal.languageHint': 'Cambie el idioma en el que le escribimos.',
    'portal.loadFailed': 'No pudimos cargar su lista',
    'portal.loadFailedHint':
      'Revise su conexión y vuelva a cargar la página. No se ha perdido nada de lo que envió.',
    'portal.emptyTitle': 'Nada pendiente por ahora',
    'portal.emptyHint': 'Cuando {firmName} necesite un documento suyo, aparecerá aquí.',
    'portal.somethingElse': '¿Algo más?',

    'upload.gotItIssuer': '¡Listo! {code} de {issuer}.',
    'upload.gotItCode': '¡Listo! {code}.',
    'upload.gotItSaved': '¡Listo! Lo guardamos en su expediente.',
    'upload.preparing': 'Preparando',
    'upload.failed': 'Esa subida no se completó.',
    'upload.unreadable': 'No pudimos leer ese. Pruebe con una foto más nítida.',
    'upload.undo': 'Deshacer',
    'upload.undoLabel': 'Deshacer — quitar {name}',
    'upload.removing': 'Quitando…',
    'upload.removingLabel': 'Quitando {name}',

    'signin.working': 'Iniciando su sesión de forma segura…',
    'signin.confirmTitle': 'Confirme su correo',
    'signin.confirmBody':
      'Este enlace no traía su correo, así que lo necesitamos una vez para confirmar que es usted. Escriba la dirección a la que su contador se lo envió: es lo único que verificamos, no hay contraseña.',
    'signin.emailLabel': 'Correo electrónico',
    'signin.continue': 'Continuar',
    'signin.expiredTitle': 'Le enviamos un enlace nuevo',
    'signin.expiredBody':
      'Este enlace seguro ya venció o ya se usó. Podemos enviarle uno nuevo.',
    'signin.expiredShort': 'Este enlace seguro ya venció.',
    'signin.yourEmail': 'Su correo electrónico',
    'signin.sendLink': 'Envíenme un enlace nuevo',
    'signin.sentTitle': 'Revise su correo',
    'signin.sentBody':
      'Enviamos un enlace seguro a {email}. Ábralo en este mismo dispositivo y listo: no hay contraseña que recordar.',

    'status.pending': 'Falta',
    'status.received': 'Recibido',
    'status.accepted': 'Aceptado',
    'status.rejected': 'Necesita otra copia',
    'status.waived': 'No hace falta',
  },
  docCode: {
    'crypto-report': 'Cripto',
    'profit-loss': 'Resultados',
    'balance-sheet': 'Balance',
    'mileage-log': 'Millas',
    'asset-schedule': 'Activos',
    'home-office': 'Oficina en casa',
    'bank-statements': 'Estados de cuenta',
    'payroll-summary': 'Nómina',
    'property-tax': 'Impuesto predial',
    'rental-summary': 'Alquiler',
    'closing-statement': 'Cierre',
    charitable: 'Donaciones',
    'medical-expenses': 'Gastos médicos',
    childcare: 'Cuidado infantil',
    'estimated-payments': 'Pagos estimados',
    'k12-educator': 'Educador',
    'energy-credit': 'Energía',
    'photo-id': 'Identificación',
    'ssn-card': 'Seguro Social',
    'voided-check': 'Datos bancarios',
    'prior-return': 'Declaración anterior',
    'engagement-letter': 'Carta de compromiso',
    organizer: 'Cuestionario',
    other: 'Otro',
  },
};
