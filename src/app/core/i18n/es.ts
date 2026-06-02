export const ES: Record<string, string> = {
  // Toast — bookings
  'toast.booking_created.summary': '¡Reserva creada!',
  'toast.booking_created.detail': 'La reserva quedó registrada en la agenda.',
  'toast.booking_updated.summary': '¡Reserva actualizada!',
  'toast.booking_updated.detail': 'Los cambios se guardaron correctamente.',
  'toast.booking_cancelled.summary': 'Reserva cancelada',
  'toast.booking_cancelled.detail': 'La reserva ha sido cancelada correctamente',
  'toast.booking_conflict.summary': 'Reserva conflictiva',

  // Toast — block time
  'toast.block_created.summary': 'Horario bloqueado',
  'toast.block_created.detail': 'El bloqueo quedó registrado en la agenda.',
  'toast.block_created_repeat.detail': 'Las repeticiones se registraron en la agenda.',
  'toast.block_conflict.summary': 'Conflicto — {{name}}',
  'toast.block_conflict.detail': 'Ya tiene un bloqueo desde las {{time}}',
  'toast.block_updated.summary': 'Bloqueo actualizado',
  'toast.block_updated.detail': 'Los cambios quedaron guardados.',
  'toast.block_deleted.summary': 'Bloqueo eliminado',
  'toast.block_moved.summary': 'Bloqueo movido',

  // Toast — client / service
  'toast.client_created.summary': 'Cliente creado',
  'toast.client_created.detail': 'El nuevo cliente ha sido registrado correctamente',
  'toast.service_created.summary': 'Servicio creado',

  // Toast — validation
  'toast.patient_required.summary': 'Paciente requerido',
  'toast.patient_required.detail': 'Seleccioná o agregá un paciente antes de guardar.',

  // Toast — connectivity
  'toast.offline.summary': 'Sin conexión',
  'toast.offline.detail': 'No hay conexión con el servidor. Se cerrará automáticamente al reconectar.',
  'toast.reconnected.summary': 'Conexión restaurada',
  'toast.reconnected.detail': 'Podés volver a trabajar con normalidad.',

  // HTTP errors — summary
  'error.400': 'Solicitud inválida',
  'error.401': 'Sesión expirada',
  'error.402': 'Pago requerido',
  'error.403': 'Sin permisos',
  'error.404': 'No encontrado',
  'error.409': 'Conflicto de horario',
  'error.422': 'Error de validación',
  'error.429': 'Demasiadas solicitudes',
  'error.500': 'Error del servidor',
  'error.502': 'Servicio no disponible',
  'error.503': 'Servicio no disponible',
  'error.504': 'Tiempo de espera agotado',
  'error.unknown': 'Error {{status}}',

  // HTTP errors — detail
  'error.400.detail': 'Los datos enviados no son válidos.',
  'error.401.detail': 'Tu sesión expiró. Iniciá sesión de nuevo.',
  'error.402.detail': 'Se requiere pago para continuar.',
  'error.403.detail': 'No tenés permisos para realizar esta acción.',
  'error.404.detail': 'El recurso ya no existe. Recargá la página.',
  'error.409.detail': 'Ese horario ya está ocupado. Revisá el calendario antes de confirmar.',
  'error.422.detail': 'Hay campos con errores. Revisá el formulario.',
  'error.429.detail': 'Demasiadas solicitudes. Esperá un momento e intentá de nuevo.',
  'error.500.detail': 'Error interno del servidor. Si persiste, contactá soporte.',
  'error.502.detail': 'El servidor no responde. Intentá en unos minutos.',
  'error.503.detail': 'El servicio está temporalmente no disponible.',
  'error.504.detail': 'El servidor tardó demasiado en responder. Intentá de nuevo.',
  'error.default.detail': 'Ocurrió un error inesperado. Intentá de nuevo.',

  // Business errors — summary (API error keys)
  'biz.invalid_input':              'Error de entrada',
  'biz.forbidden':                  'Sin permisos',
  'biz.provider_location_mismatch': 'Sede incorrecta',
  'biz.conflict':                   'Conflicto de horario',
  'biz.already_cancelled':          'Reserva ya cancelada',
  'biz.slot_collision':             'Conflicto de horario',
  'biz.client_not_found':           'Cliente no encontrado',
  'biz.already_inactive':           'Ya inactivo',
  'biz.pack_not_active':            'Pack inactivo',
  'biz.no_sessions_remaining':      'Sin sesiones disponibles',

  // Business errors — summary
  'biz.sale_already_exists':          'Venta duplicada',
  'biz.amount_exceeds_remaining':     'Monto supera el saldo',

  // Business errors — detail
  'biz.sale_already_exists.detail':       'Ya existe una venta para este concepto.',
  'biz.amount_exceeds_remaining.detail':  'El monto supera el saldo pendiente de la venta.',

  'biz.invalid_input.detail':              'Verificá los campos e intentá de nuevo.',
  'biz.forbidden.detail':                  'No tenés permisos para realizar esta acción.',
  'biz.provider_location_mismatch.detail': 'El profesional no pertenece a la sede seleccionada.',
  'biz.conflict.detail':                   'Ese horario ya está ocupado.',
  'biz.already_cancelled.detail':          'Esta reserva ya fue cancelada.',
  'biz.slot_collision.detail':             'Ese horario ya está bloqueado o reservado.',
  'biz.client_not_found.detail':           'No se encontró el perfil del cliente.',
  'biz.already_inactive.detail':           'Este registro ya está inactivo.',
  'biz.pack_not_active.detail':            'El pack no está activo.',
  'biz.no_sessions_remaining.detail':      'El pack no tiene sesiones disponibles.',

  // UI
  'ui.logout': 'Salir',
  'ui.dark_mode': 'Modo Oscuro',
  'ui.light_mode': 'Modo Claro',
  'ui.language': 'Idioma',

  // Nav — admin
  'nav.dashboard': 'Dashboard',
  'nav.locations': 'Ubicaciones',
  'nav.providers': 'Profesionales',
  'nav.calendar': 'Agenda',
  'nav.clients': 'Clientes',
  'nav.packs': 'Packs',

  // Nav — provider
  'nav.my_schedule': 'Mi Agenda',
  'nav.availability': 'Disponibilidad',

  // Booking statuses
  'status.1': 'Reservado',
  'status.2': 'Confirmado',
  'status.3': 'Asiste',
  'status.4': 'No asistió',
  'status.5': 'Pendiente',
  'status.6': 'En espera',
  'status.7': 'Cancelado',

  // Booking-dialog (legacy) statuses
  'bd.status.1': 'Pendiente',
  'bd.status.2': 'Confirmado',
  'bd.status.3': 'Completado',
  'bd.status.4': 'Cancelado',

  // Repeat options
  'repeat.daily': 'Diariamente',
  'repeat.weekly': 'Semanalmente',
  'repeat.monthly': 'Mensualmente',
  'repeat.end.after': 'Después de',
  'repeat.end.until': 'Fecha específica',

  // Days of week
  'day.0': 'Dom',
  'day.1': 'Lun',
  'day.2': 'Mar',
  'day.3': 'Mie',
  'day.4': 'Jue',
  'day.5': 'Vie',
  'day.6': 'Sab',

  // Block scope
  'scope.location': 'Ubicación específica',
  'scope.provider': 'Profesional específico',

  // Misc
  'misc.unassigned': 'Sin asignar',

  // Calendar buttons
  'cal.today': 'Hoy',
  'cal.month': 'Mes',
  'cal.week': 'Semana',
  'cal.day': 'Día',
  'cal.list': 'Lista',
  'cal.new_booking': 'Reserva',
  'cal.block_time': 'Bloquear',
  'cal.placeholder.all_locations': 'Todas las ubicaciones',
  'cal.placeholder.all_providers': 'Todos los profesionales',
  'cal.placeholder.all_statuses': 'Todos los estados',

  // Slot action menu
  'slot.new_booking': 'Nueva Reserva',
  'slot.block_time': 'Bloquear Horario',

  // Common shared labels
  'common.cancel': 'Cancelar',
  'common.close': 'Cerrar',
  'common.back': 'Volver',
  'common.apply': 'Aplicar',
  'common.search': 'Buscar...',
  'common.date': 'Fecha',
  'common.time': 'Hora',
  'common.price': 'Precio',
  'common.every': 'Cada',
  'common.repeat': 'Repetir',
  'common.ends': 'Finaliza',
  'common.occurrences': 'repeticiones',
  'common.end_date': 'Fecha de finalización',

  // Block-time dialog
  'block.title.create': 'Bloquear Horario',
  'block.title.edit': 'Bloqueo de horas',
  'block.apply_to': 'Aplicar bloqueo a:',
  'block.select_location': 'Seleccionar ubicación',
  'block.choose_location': 'Elige una ubicación',
  'block.select_provider': 'Seleccionar profesional',
  'block.choose_provider': 'Elige un profesional',
  'block.date_start': 'Fecha inicio',
  'block.time_start': 'Hora inicio',
  'block.date_end': 'Fecha fin',
  'block.time_end': 'Hora fin',
  'block.reason': 'Motivo (opcional)',
  'block.reason_placeholder': 'Motivo del bloqueo',
  'block.repeat_toggle': 'Repetir bloqueo',
  'block.repeat_freq': 'Repetir',
  'block.repeat_on': 'Se repite el',
  'block.ends': 'Finaliza:',
  'block.occurrences': 'repeticiones',
  'block.includes_original': 'Incluye la original',
  'block.interval.day': 'día(s)',
  'block.interval.week': 'semana(s)',
  'block.interval.month': 'mes(es)',
  'block.btn.save': 'Guardar bloqueo',
  'block.btn.block': 'Bloquear horario',
  'block.btn.block_repeat': 'Bloquear y repetir',

  // Booking form dialog — main
  'booking_form.title.create': 'Nueva Reserva',
  'booking_form.title.edit': 'Editar Reserva',
  'booking_form.repeat_btn': 'Repetir',
  'booking_form.repeat_active': 'Repetición activa',
  'booking_form.patient': 'Paciente',
  'booking_form.patient_placeholder': 'Buscar por nombre, apellido, email...',
  'booking_form.add_patient': 'Agregar paciente',
  'booking_form.provider': 'Profesional',
  'booking_form.provider_placeholder': 'Seleccionar profesional',
  'booking_form.service': 'Servicio',
  'booking_form.service_placeholder': 'Seleccionar servicio o pack',
  'booking_form.create_service_btn': 'Crear un nuevo servicio',
  'booking_form.status': 'Estado',
  'booking_form.location': 'Sede / Ubicación',
  'booking_form.location_placeholder': 'Seleccionar sede',
  'booking_form.additional_info': 'Información adicional',
  'booking_form.notes_patient': 'Notas para el paciente',
  'booking_form.notes_patient_placeholder': 'Visibles para el paciente',
  'booking_form.notes_internal': 'Nota interna',
  'booking_form.notes_internal_placeholder': 'Solo visible para el equipo',
  'booking_form.btn.save': 'Guardar reserva',
  'booking_form.btn.save_repeat': 'Guardar repetición',

  // Booking form dialog — service creation panel
  'booking_form.new_service.title': 'Crear un nuevo servicio',
  'booking_form.new_service.name': 'Nombre del servicio',
  'booking_form.new_service.name_placeholder': 'Nombre de la categoría',
  'booking_form.new_service.duration': 'Duración (min)',
  'booking_form.new_service.duration_placeholder': 'Ej. 5, 10, 45, 200',
  'booking_form.btn.save_service': 'Guardar servicio',

  // Booking form dialog — repeat dialog
  'booking_form.repeat.title': 'Repeticiones de reserva',
  'booking_form.repeat.weeks': 'semanas',
  'booking_form.repeat.months': 'meses',
  'booking_form.repeat.on': 'Se repite el',
  'booking_form.repeat.after': 'Después de',
  'booking_form.repeat.specific_date': 'Fecha específica',
  'booking_form.repeat.end_sublabel': 'Fecha de finalización',

  // New patient dialog
  'patient.dialog_title': 'Nuevo Paciente',
  'patient.first_name': 'Nombre',
  'patient.last_name': 'Apellido',
  'patient.email': 'Email',
  'patient.phone': 'Teléfono',
  'patient.first_name_placeholder': 'Juan',
  'patient.last_name_placeholder': 'Pérez',
  'patient.email_placeholder': 'juan@email.com',
  'patient.phone_placeholder': 'Teléfono',
  'patient.error.first_name_required': 'El nombre es obligatorio',
  'patient.error.last_name_required': 'El apellido es obligatorio',
  'patient.error.email_required': 'El email es obligatorio',
  'patient.error.email_invalid': 'El email no es válido',
  'patient.error.phone_invalid': 'El número de teléfono no es válido para este país',
  'patient.btn.save': 'Guardar paciente',

  // Booking dialog (legacy)
  'booking_dlg.title.create': 'Nueva Reserva',
  'booking_dlg.title.edit': 'Editar Reserva',
  'booking_dlg.placeholder.client': 'Seleccionar cliente',
  'booking_dlg.placeholder.service': 'Seleccionar servicio',
  'booking_dlg.placeholder.location': 'Seleccionar ubicación',
  'booking_dlg.placeholder.provider': 'Seleccionar profesional (opcional)',
  'booking_dlg.date_time': 'Fecha y hora',
  'booking_dlg.duration': 'Duración (min)',
  'booking_dlg.notes_placeholder': 'Notas adicionales',
  'booking_dlg.btn.cancel_booking': 'Cancelar Reserva',
  'booking_dlg.btn.update': 'Actualizar',
  'booking_dlg.btn.create': 'Crear',
};
