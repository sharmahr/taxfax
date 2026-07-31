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
    'portal.done': 'Listo · {doneCount}',
    'portal.uploadedCount': '{uploadedCount} de {expectedCount} enviados',
    'portal.private': 'Privado',
    'portal.needsAnotherTry': 'Hace falta otro intento: {detail}',
    'portal.yourAccountant': 'su contador',
    'portal.somethingElseHint':
      '¿Tiene un documento que no está en la lista? Agréguelo aquí y {firmName} lo acomoda.',

    'upload.percent': '{percent} %',
    'upload.tryAgain': 'Reintentar',
    'upload.remove': 'Quitar',
    'upload.cancel': 'Cancelar',
    'upload.chooseFiles': 'Elegir de sus archivos',
    'upload.dropPrompt': 'Arrastre aquí una foto o un {format}, o',
    'upload.chooseFile': 'elija un archivo',
    'upload.unsupported': 'Ese tipo de archivo no sirve. Tome una foto o suba un {format}.',
    'upload.empty': 'Ese archivo parece vacío. Pruebe con otro.',
    'upload.tooLarge': 'Ese archivo pesa demasiado: el límite es {limit}.',
    'upload.photoTooLarge': 'Esa foto pesa demasiado: el límite es {limit}.',
    'upload.heicUnreadable':
      'No pudimos leer esa foto en este dispositivo. Tómela otra vez o suba un {format}.',
    'upload.heicFailed': 'No pudimos procesar esa foto. Pruebe con un {format}.',
  },
  reason: {
    'reason.engagement': 'Necesario antes de que podamos empezar a trabajar.',
    'reason.photoId': 'Nos hace falta para verificar su identidad al presentar en línea.',
    'reason.photoIdBoth':
      'Ambos cónyuges necesitan una identificación con foto vigente para presentar en línea.',
    'reason.ipPin':
      'Usted usó un PIN de Protección de Identidad del IRS en su declaración de {year}. El IRS emite uno nuevo cada diciembre.',
    'reason.priorReturn':
      'Envíe la declaración completa del año pasado y con ella armamos el resto de esta lista automáticamente.',

    'reason.w2Issuers': 'El año pasado tuvo {count} {code}: de {issuers}.',
    'reason.w2IssuersMany': 'El año pasado tuvo {count} {code}: de {issuers}.',
    'reason.w2Wages': 'Su declaración de {year} reportó {amount} en salarios.',
    'reason.w2Each': 'Uno de cada empleador.',

    'reason.interestIssuers': 'El año pasado recibió intereses de {issuers}.',
    'reason.interestAmount':
      'Su declaración de {year} reportó {amount} en ingresos por intereses.',
    'reason.dividendsIssuers': 'El año pasado recibió dividendos de {issuers}.',
    'reason.dividendsAmount': 'Su declaración de {year} reportó {amount} en dividendos.',
    'reason.brokerIssuers':
      'El año pasado presentó el {code} con movimientos en {issuers}. Necesitamos el estado consolidado completo, incluidas las páginas de costo base.',
    'reason.brokerSchedule':
      'El año pasado presentó el {code}, así que necesitamos el {code2} consolidado de su casa de bolsa, con el detalle del costo base.',

    'reason.retirement':
      'Su declaración de {year} reportó {amount} de una IRA, una pensión o una anualidad.',
    'reason.socialSecurity':
      'El año pasado reportó {amount} en beneficios del Seguro Social.',
    'reason.unemployment':
      'El año pasado se reportó desempleo o un reembolso de impuestos estatales.',

    'reason.scheduleCMany':
      'El año pasado presentó {count} {code}: un estado de resultados por cada negocio.',
    'reason.scheduleCIncome':
      'El año pasado presentó el {code} con {amount} de ingreso neto del negocio. Un estado de resultados del año completo es la vía más rápida para terminar.',
    'reason.scheduleC':
      'El año pasado presentó el {code}. Un estado de resultados del año completo es la vía más rápida para terminar.',
    'reason.necIssuers': 'El año pasado recibió {code} de {issuers}.',
    'reason.necSelfEmployed':
      'El año pasado reportó ingresos por cuenta propia: envíe cualquier {code} que le llegue.',
    'reason.paymentAppIssuers':
      'El año pasado recibió un {code} de {issuers}. El umbral para reportar sigue bajando, así que espere otro.',
    'reason.paymentApp':
      'El año pasado recibió un {code}. El umbral para reportar sigue bajando, así que espere otro.',
    'reason.mileage':
      'El año pasado dedujo gastos de vehículo. El IRS exige un registro de millas llevado al día, así que envíe su cuaderno o la exportación de la aplicación.',
    'reason.homeOffice':
      'El año pasado dedujo una oficina en casa: necesitamos los metros cuadrados de este año más servicios, renta o intereses hipotecarios, y seguro.',
    'reason.assets':
      'Envíe las facturas de todo lo que el negocio compró por más de $2,500: equipo, vehículos o mejoras.',
    'reason.payroll':
      'Los reportes de nómina de fin de año ({codes}) cuadran los salarios de la declaración.',
    'reason.bankStatements':
      'El año pasado tuvo ingresos del negocio pero no hay archivo de contabilidad. Con doce meses de estados de cuenta le armamos el estado de resultados.',

    'reason.k1PartnershipIssuers':
      'Usted tiene participaciones en {issuers}. Los {code} de sociedades suelen llegar tarde: envíe cada uno en cuanto lo reciba.',
    'reason.k1Partnership': 'El año pasado recibió {count} {code} de sociedad.',
    'reason.k1PartnershipMany': 'El año pasado recibió {count} {code} de sociedades.',
    'reason.k1SCorpIssuers': 'Usted es accionista de {issuers}.',
    'reason.k1SCorp': 'El año pasado recibió {count} {code} de sociedad S.',
    'reason.k1SCorpMany': 'El año pasado recibió {count} {code} de sociedades S.',
    'reason.k1Trust': 'El año pasado fue beneficiario de un fideicomiso o de una sucesión.',

    'reason.rentalMany':
      'El {code} mostró {count} propiedades en alquiler el año pasado: envíe ingresos y gastos de cada una.',
    'reason.rentalOne':
      'El año pasado presentó el {code}. Envíe la renta cobrada de todo el año y los gastos de la propiedad.',
    'reason.mortgageIssuers': 'El año pasado pagó intereses hipotecarios a {issuers}.',
    'reason.mortgage': 'El año pasado dedujo intereses hipotecarios.',
    'reason.propertyTax': 'El año pasado dedujo impuestos sobre bienes raíces.',
    'reason.closing': 'Solo si este año compró, vendió o refinanció una propiedad.',

    'reason.charitableGave':
      'El año pasado detalló deducciones y donó {amount}. Todo lo que pase de $250 necesita una constancia por escrito de la organización benéfica.',
    'reason.charitable':
      'El año pasado detalló deducciones. Todo lo que pase de $250 necesita una constancia por escrito de la organización benéfica.',
    'reason.medical': 'El año pasado reclamó {amount} en gastos médicos.',
    'reason.studentLoan': 'El año pasado dedujo intereses de préstamos estudiantiles.',
    'reason.education': 'El año pasado reclamó un crédito educativo.',
    'reason.childcare':
      'El año pasado reclamó el crédito por cuidado de menores y dependientes. Necesitamos el nombre, la dirección y el número de identificación fiscal del proveedor, no solo el monto.',
    'reason.ira': 'El año pasado dedujo una aportación a una IRA.',
    'reason.hsa': 'El año pasado presentó el Formulario {code} por una HSA.',
    'reason.hsaSpend': 'Nos hace falta si este año gastó de su HSA.',
    'reason.energy': 'El año pasado reclamó un crédito de energía para el hogar.',
    'reason.educator': 'El año pasado reclamó la deducción por gastos de educador.',
    'reason.marketplace':
      'El año pasado tuvo cobertura del Mercado de Seguros. Sin el Formulario {code} el IRS rechaza la declaración de plano.',

    'reason.estimatesTotal':
      'El año pasado hizo pagos estimados por un total de {amount}. Necesitamos la fecha y el monto exactos de cada uno.',
    'reason.estimates':
      'El año pasado hizo pagos estimados. Necesitamos la fecha y el monto exactos de cada uno.',
    'reason.bankInfo':
      'Para que cualquier reembolso le llegue por depósito directo y no como cheque en papel.',
    'reason.refundDeposit': 'Para que un reembolso le llegue por depósito directo.',

    'reason.crypto':
      'El año pasado respondió que sí a la pregunta sobre activos digitales. Envíe la exportación completa de movimientos de cada plataforma y cada monedero.',
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
