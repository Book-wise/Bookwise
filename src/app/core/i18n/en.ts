export const EN: Record<string, string> = {
  // Toast — bookings
  'toast.booking_created.summary': 'Booking created',
  'toast.booking_created.detail': 'The booking has been registered in the schedule.',
  'toast.booking_updated.summary': 'Booking updated',
  'toast.booking_updated.detail': 'Changes were saved successfully.',
  'toast.booking_cancelled.summary': 'Booking cancelled',
  'toast.booking_cancelled.detail': 'The booking has been cancelled successfully',
  'toast.booking_conflict.summary': 'Conflicting booking',

  // Toast — block time
  'toast.block_created.summary': 'Time blocked',
  'toast.block_created.detail': 'The block has been registered in the schedule.',
  'toast.block_created_repeat.detail': 'The recurring blocks have been registered.',
  'toast.block_conflict.summary': 'Conflict — {{name}}',
  'toast.block_conflict.detail': 'Already has a block starting at {{time}}',
  'toast.block_updated.summary': 'Block updated',
  'toast.block_updated.detail': 'Changes were saved.',
  'toast.block_deleted.summary': 'Block deleted',
  'toast.block_moved.summary': 'Block moved',

  // Toast — client / service
  'toast.client_created.summary': 'Client created',
  'toast.client_created.detail': 'The new client has been registered successfully',
  'toast.service_created.summary': 'Service created',

  // Toast — validation
  'toast.patient_required.summary': 'Patient required',
  'toast.patient_required.detail': 'Please select or add a patient before saving.',

  // Toast — connectivity
  'toast.offline.summary': 'No connection',
  'toast.offline.detail': 'No connection to the server. Will close automatically upon reconnection.',
  'toast.reconnected.summary': 'Connection restored',
  'toast.reconnected.detail': 'You can resume working normally.',

  // HTTP errors — summary
  'error.400': 'Invalid request',
  'error.401': 'Session expired',
  'error.402': 'Payment required',
  'error.403': 'Unauthorized',
  'error.404': 'Not found',
  'error.409': 'Schedule conflict',
  'error.422': 'Validation error',
  'error.429': 'Too many requests',
  'error.500': 'Server error',
  'error.502': 'Service unavailable',
  'error.503': 'Service unavailable',
  'error.504': 'Request timeout',
  'error.unknown': 'Error {{status}}',

  // HTTP errors — detail
  'error.400.detail': 'The submitted data is invalid.',
  'error.401.detail': 'Your session expired. Please log in again.',
  'error.402.detail': 'Payment is required to continue.',
  'error.403.detail': 'You do not have permission to perform this action.',
  'error.404.detail': 'The resource no longer exists. Please refresh the page.',
  'error.409.detail': 'That time slot is already taken. Review the calendar before confirming.',
  'error.422.detail': 'Some fields have errors. Please review the form.',
  'error.429.detail': 'Too many requests. Please wait a moment and try again.',
  'error.500.detail': 'Internal server error. Contact support if this persists.',
  'error.502.detail': 'The server is not responding. Please try again in a few minutes.',
  'error.503.detail': 'The service is temporarily unavailable.',
  'error.504.detail': 'The server took too long to respond. Please try again.',
  'error.default.detail': 'An unexpected error occurred. Please try again.',

  // Business errors (API error keys)
  'biz.invalid_input':              'Invalid input',
  'biz.forbidden':                  'Unauthorized',
  'biz.provider_location_mismatch': 'Wrong location',
  'biz.conflict':                   'Scheduling conflict',
  'biz.already_cancelled':          'Already cancelled',
  'biz.slot_collision':             'Scheduling conflict',
  'biz.client_not_found':           'Client not found',
  'biz.already_inactive':           'Already inactive',
  'biz.pack_not_active':            'Pack not active',
  'biz.no_sessions_remaining':      'No sessions remaining',

  // UI
  'ui.logout': 'Log out',
  'ui.dark_mode': 'Dark Mode',
  'ui.light_mode': 'Light Mode',
  'ui.language': 'Language',

  // Nav — admin
  'nav.dashboard': 'Dashboard',
  'nav.locations': 'Locations',
  'nav.providers': 'Providers',
  'nav.calendar': 'Schedule',
  'nav.clients': 'Clients',
  'nav.packs': 'Packs',

  // Nav — provider
  'nav.my_schedule': 'My Schedule',
  'nav.availability': 'Availability',

  // Booking statuses
  'status.1': 'Booked',
  'status.2': 'Confirmed',
  'status.3': 'Attended',
  'status.4': 'No-show',
  'status.5': 'Pending',
  'status.6': 'Waiting',
  'status.7': 'Cancelled',

  // Booking-dialog (legacy) statuses
  'bd.status.1': 'Pending',
  'bd.status.2': 'Confirmed',
  'bd.status.3': 'Completed',
  'bd.status.4': 'Cancelled',

  // Repeat options
  'repeat.daily': 'Daily',
  'repeat.weekly': 'Weekly',
  'repeat.monthly': 'Monthly',
  'repeat.end.after': 'After',
  'repeat.end.until': 'Specific date',

  // Days of week
  'day.0': 'Sun',
  'day.1': 'Mon',
  'day.2': 'Tue',
  'day.3': 'Wed',
  'day.4': 'Thu',
  'day.5': 'Fri',
  'day.6': 'Sat',

  // Block scope
  'scope.location': 'Specific location',
  'scope.provider': 'Specific provider',

  // Misc
  'misc.unassigned': 'Unassigned',

  // Calendar buttons
  'cal.today': 'Today',
  'cal.month': 'Month',
  'cal.week': 'Week',
  'cal.day': 'Day',
  'cal.list': 'List',
  'cal.new_booking': 'Booking',
  'cal.block_time': 'Block',
  'cal.placeholder.all_locations': 'All locations',
  'cal.placeholder.all_providers': 'All providers',
  'cal.placeholder.all_statuses': 'All statuses',

  // Slot action menu
  'slot.new_booking': 'New Booking',
  'slot.block_time': 'Block Time',

  // Common shared labels
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.back': 'Back',
  'common.apply': 'Apply',
  'common.search': 'Search...',
  'common.date': 'Date',
  'common.time': 'Time',
  'common.price': 'Price',
  'common.every': 'Every',
  'common.repeat': 'Repeat',
  'common.ends': 'Ends',
  'common.occurrences': 'occurrences',
  'common.end_date': 'End date',

  // Block-time dialog
  'block.title.create': 'Block Time',
  'block.title.edit': 'Edit Block',
  'block.apply_to': 'Apply block to:',
  'block.select_location': 'Select location',
  'block.choose_location': 'Choose a location',
  'block.select_provider': 'Select provider',
  'block.choose_provider': 'Choose a provider',
  'block.date_start': 'Start date',
  'block.time_start': 'Start time',
  'block.date_end': 'End date',
  'block.time_end': 'End time',
  'block.reason': 'Reason (optional)',
  'block.reason_placeholder': 'Block reason',
  'block.repeat_toggle': 'Repeat block',
  'block.repeat_freq': 'Repeat',
  'block.repeat_on': 'Repeat on',
  'block.ends': 'Ends:',
  'block.occurrences': 'occurrences',
  'block.includes_original': 'Includes the original',
  'block.interval.day': 'day(s)',
  'block.interval.week': 'week(s)',
  'block.interval.month': 'month(s)',
  'block.btn.save': 'Save block',
  'block.btn.block': 'Block time',
  'block.btn.block_repeat': 'Block & repeat',

  // Booking form dialog — main
  'booking_form.title.create': 'New Booking',
  'booking_form.title.edit': 'Edit Booking',
  'booking_form.repeat_btn': 'Repeat',
  'booking_form.repeat_active': 'Repeat active',
  'booking_form.patient': 'Patient',
  'booking_form.patient_placeholder': 'Search by name, last name, email...',
  'booking_form.add_patient': 'Add patient',
  'booking_form.provider': 'Provider',
  'booking_form.provider_placeholder': 'Select provider',
  'booking_form.service': 'Service',
  'booking_form.service_placeholder': 'Select service or pack',
  'booking_form.create_service_btn': 'Create a new service',
  'booking_form.location': 'Location',
  'booking_form.location_placeholder': 'Select location',
  'booking_form.additional_info': 'Additional information',
  'booking_form.notes_patient': 'Notes for patient',
  'booking_form.notes_patient_placeholder': 'Visible to patient',
  'booking_form.notes_internal': 'Internal note',
  'booking_form.notes_internal_placeholder': 'Visible to staff only',
  'booking_form.btn.save': 'Save booking',
  'booking_form.btn.save_repeat': 'Save recurring',

  // Booking form dialog — service creation panel
  'booking_form.new_service.title': 'Create a new service',
  'booking_form.new_service.name': 'Service name',
  'booking_form.new_service.name_placeholder': 'Category name',
  'booking_form.new_service.duration': 'Duration (min)',
  'booking_form.new_service.duration_placeholder': 'e.g. 5, 10, 45, 200',
  'booking_form.btn.save_service': 'Save service',

  // Booking form dialog — repeat dialog
  'booking_form.repeat.title': 'Recurring booking',
  'booking_form.repeat.weeks': 'weeks',
  'booking_form.repeat.months': 'months',
  'booking_form.repeat.on': 'Repeats on',
  'booking_form.repeat.after': 'After',
  'booking_form.repeat.specific_date': 'Specific date',
  'booking_form.repeat.end_sublabel': 'End date',

  // New patient dialog
  'patient.dialog_title': 'New Patient',
  'patient.first_name': 'First name',
  'patient.last_name': 'Last name',
  'patient.email': 'Email',
  'patient.phone': 'Phone',
  'patient.first_name_placeholder': 'John',
  'patient.last_name_placeholder': 'Smith',
  'patient.email_placeholder': 'john@email.com',
  'patient.phone_placeholder': 'Phone number',
  'patient.error.first_name_required': 'First name is required',
  'patient.error.last_name_required': 'Last name is required',
  'patient.error.email_required': 'Email is required',
  'patient.error.email_invalid': 'Invalid email address',
  'patient.error.phone_invalid': 'Invalid phone number for this country',
  'patient.btn.save': 'Save patient',

  // Booking dialog (legacy)
  'booking_dlg.title.create': 'New Booking',
  'booking_dlg.title.edit': 'Edit Booking',
  'booking_dlg.placeholder.client': 'Select client',
  'booking_dlg.placeholder.service': 'Select service',
  'booking_dlg.placeholder.location': 'Select location',
  'booking_dlg.placeholder.provider': 'Select provider (optional)',
  'booking_dlg.date_time': 'Date & time',
  'booking_dlg.duration': 'Duration (min)',
  'booking_dlg.notes_placeholder': 'Additional notes',
  'booking_dlg.btn.cancel_booking': 'Cancel Booking',
  'booking_dlg.btn.update': 'Update',
  'booking_dlg.btn.create': 'Create',
};
