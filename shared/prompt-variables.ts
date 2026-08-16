export const PROMPT_VARIABLES = ['$DATETIME', '$TIMEZONE'] as const;
export type PromptVariable = (typeof PROMPT_VARIABLES)[number];

interface PromptVariableContext {
  now: Date;
  timeZone: string;
}

function dateTimeInTimeZone(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const localAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  const utcAtWholeSecond = Math.floor(now.getTime() / 1_000) * 1_000;
  const offsetMinutes = Math.round((localAsUtc - utcAtWholeSecond) / 60_000);
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteOffset = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absoluteOffset / 60)).padStart(2, '0');
  const offsetRemainder = String(absoluteOffset % 60).padStart(2, '0');

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}${sign}${offsetHours}:${offsetRemainder}`;
}

export function expandPromptVariables(template: string, context: PromptVariableContext): string {
  if (!template) return '';
  const replacements: Record<PromptVariable, string> = {
    $DATETIME: dateTimeInTimeZone(context.now, context.timeZone),
    $TIMEZONE: context.timeZone,
  };
  return PROMPT_VARIABLES.reduce(
    (prompt, variable) => prompt.replaceAll(variable, replacements[variable]),
    template,
  );
}
