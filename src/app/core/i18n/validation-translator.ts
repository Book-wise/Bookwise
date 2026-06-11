import { Language } from '@services/language.service';

/**
 * Translates Laravel validation messages (now returned in English by the API)
 * into Spanish for the ES UI. English messages pass through unchanged since
 * the API already returns them in the right language for the EN UI.
 */

// Messages that don't follow the standard "The :attribute field ..." template.
const EXACT_MESSAGES_ES: Record<string, string> = {
  'These credentials do not match our records.': 'Las credenciales no coinciden con nuestros registros.',
};

// Laravel formats snake_case attributes as lowercase, space-separated words
// (e.g. "provider_id" -> "provider id").
const FIELD_LABELS_ES: Record<string, string> = {
  'provider id': 'el profesional',
  'location id': 'la ubicación',
  'service id': 'el servicio',
  'service pack id': 'el pack de servicio',
  'client id': 'el cliente',
  'client pack id': 'el pack del cliente',
  'booking id': 'la reserva',
  'status id': 'el estado',
  'wc order id': 'el pedido',
  'start time': 'la hora de inicio',
  'end time': 'la hora de fin',
  'paid at': 'la fecha de pago',
  date: 'la fecha',
  duration: 'la duración',
  'custom duration minutes': 'la duración personalizada',
  reason: 'el motivo',
  notes: 'las notas',
  price: 'el precio',
  total: 'el total',
  amount: 'el monto',
  'payment method': 'el método de pago',
  email: 'el email',
  password: 'la contraseña',
  'password confirmation': 'la confirmación de contraseña',
  name: 'el nombre',
  phone: 'el teléfono',
  scope: 'el alcance',
};

function labelEs(attribute: string): string {
  return FIELD_LABELS_ES[attribute] ?? attribute;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Each pattern matches a standard Laravel English validation message and
// builds its Spanish translation from the captured groups.
const RULE_PATTERNS_ES: { regex: RegExp; build: (...groups: string[]) => string }[] = [
  { regex: /^The (.+) field is required\.$/, build: (a) => `${capitalize(labelEs(a))} es obligatorio.` },
  { regex: /^The (.+) field must be an integer\.$/, build: (a) => `${capitalize(labelEs(a))} debe ser un número entero.` },
  { regex: /^The (.+) field must be a number\.$/, build: (a) => `${capitalize(labelEs(a))} debe ser un número.` },
  { regex: /^The (.+) field must be true or false\.$/, build: (a) => `${capitalize(labelEs(a))} debe ser verdadero o falso.` },
  { regex: /^The (.+) field must be a string\.$/, build: (a) => `${capitalize(labelEs(a))} debe ser texto.` },
  { regex: /^The (.+) field must be a valid email address\.$/, build: (a) => `${capitalize(labelEs(a))} debe ser un email válido.` },
  { regex: /^The (.+) field must be a valid date\.$/, build: (a) => `${capitalize(labelEs(a))} debe ser una fecha válida.` },
  { regex: /^The (.+) field must be a date\.$/, build: (a) => `${capitalize(labelEs(a))} debe ser una fecha válida.` },
  { regex: /^The (.+) field must match the format (.+)\.$/, build: (a, fmt) => `${capitalize(labelEs(a))} debe tener el formato ${fmt}.` },
  { regex: /^The (.+) field must be a date after or equal to (.+)\.$/, build: (a, other) => `${capitalize(labelEs(a))} debe ser una fecha posterior o igual a ${labelEs(other)}.` },
  { regex: /^The (.+) field must be a date after (.+)\.$/, build: (a, other) => `${capitalize(labelEs(a))} debe ser una fecha posterior a ${labelEs(other)}.` },
  { regex: /^The (.+) field must be a date before or equal to (.+)\.$/, build: (a, other) => `${capitalize(labelEs(a))} debe ser una fecha anterior o igual a ${labelEs(other)}.` },
  { regex: /^The (.+) field must be a date before (.+)\.$/, build: (a, other) => `${capitalize(labelEs(a))} debe ser una fecha anterior a ${labelEs(other)}.` },
  { regex: /^The selected (.+) is invalid\.$/, build: (a) => `${capitalize(labelEs(a))} seleccionado no es válido.` },
  { regex: /^The (.+) field confirmation does not match\.$/, build: (a) => `La confirmación de ${labelEs(a)} no coincide.` },
  { regex: /^The (.+) field format is invalid\.$/, build: (a) => `El formato de ${labelEs(a)} es inválido.` },
  { regex: /^The (.+) field must not be greater than (\d+) characters\.$/, build: (a, n) => `${capitalize(labelEs(a))} no debe superar los ${n} caracteres.` },
  { regex: /^The (.+) field must not be greater than (.+)\.$/, build: (a, n) => `${capitalize(labelEs(a))} no debe ser mayor a ${n}.` },
  { regex: /^The (.+) field must be at least (\d+) characters\.$/, build: (a, n) => `${capitalize(labelEs(a))} debe tener al menos ${n} caracteres.` },
  { regex: /^The (.+) field must be at least (.+)\.$/, build: (a, n) => `${capitalize(labelEs(a))} debe ser al menos ${n}.` },
  { regex: /^The (.+) field must be between (.+) and (.+)\.$/, build: (a, min, max) => `${capitalize(labelEs(a))} debe estar entre ${min} y ${max}.` },
  { regex: /^The (.+) field must be greater than (.+)\.$/, build: (a, val) => `${capitalize(labelEs(a))} debe ser mayor a ${val}.` },
  { regex: /^The (.+) field must be less than (.+)\.$/, build: (a, val) => `${capitalize(labelEs(a))} debe ser menor a ${val}.` },
  { regex: /^The (.+) field and (.+) must be different\.$/, build: (a, other) => `${capitalize(labelEs(a))} y ${labelEs(other)} deben ser diferentes.` },
  { regex: /^The (.+) field and (.+) must match\.$/, build: (a, other) => `${capitalize(labelEs(a))} y ${labelEs(other)} deben coincidir.` },
  // Custom rule used by available_slots (multiple_of)
  { regex: /^The duration must be a multiple of (\d+) minutes\.$/, build: (n) => `La duración debe ser un múltiplo de ${n} minutos.` },
];

export function translateValidationMessage(message: string, lang: Language): string {
  if (lang === 'en') return message;

  const exact = EXACT_MESSAGES_ES[message];
  if (exact) return exact;

  for (const { regex, build } of RULE_PATTERNS_ES) {
    const match = message.match(regex);
    if (match) return build(...match.slice(1));
  }

  return message;
}
