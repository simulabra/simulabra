import { __, base } from './base.js';

export default await async function (_, $) {
  $.Class.new({
    name: 'TimePolicy',
    doc: 'Provides consistent UTC-based date arithmetic for recurrence calculations',
    slots: [
      $.Static.new({
        name: 'addDays',
        doc: 'Add N days to a date using UTC arithmetic',
        do(date, days) {
          const result = new Date(date);
          result.setUTCDate(result.getUTCDate() + days);
          return result;
        }
      }),
      $.Static.new({
        name: 'addWeeks',
        doc: 'Add N weeks to a date using UTC arithmetic',
        do(date, weeks) {
          return _.TimePolicy.addDays(date, weeks * 7);
        }
      }),
      $.Static.new({
        name: 'addMonths',
        doc: 'Add N months to a date using UTC arithmetic',
        do(date, months) {
          const result = new Date(date);
          const targetMonth = result.getUTCMonth() + months;
          result.setUTCMonth(targetMonth);
          return result;
        }
      }),
      $.Static.new({
        name: 'getDayOfWeek',
        doc: 'Get UTC day of week (0=Sunday, 6=Saturday)',
        do(date) {
          return date.getUTCDay();
        }
      }),
      $.Static.new({
        name: 'endOfDay',
        doc: 'Get the end of the UTC day (23:59:59.999)',
        do(date) {
          const result = new Date(date);
          result.setUTCHours(23, 59, 59, 999);
          return result;
        }
      }),
      $.Static.new({
        name: 'startOfDay',
        doc: 'Get the start of the UTC day (00:00:00.000)',
        do(date) {
          const result = new Date(date);
          result.setUTCHours(0, 0, 0, 0);
          return result;
        }
      }),
      $.Static.new({
        name: 'isSameDay',
        doc: 'Check if two dates are the same UTC day',
        do(date1, date2) {
          return date1.getUTCFullYear() === date2.getUTCFullYear() &&
                 date1.getUTCMonth() === date2.getUTCMonth() &&
                 date1.getUTCDate() === date2.getUTCDate();
        }
      }),
      $.Static.new({
        name: 'isAfterDay',
        doc: 'Check if date1 is after date2 (comparing full UTC days)',
        do(date1, date2) {
          return _.TimePolicy.startOfDay(date1) > _.TimePolicy.endOfDay(date2);
        }
      }),
    ]
  });

  $.Class.new({
    name: 'RecurrenceRule',
    doc: 'Rule for recurring events with daily, weekly, or monthly patterns',
    slots: [
      $.EnumVar.new({
        name: 'pattern',
        doc: 'recurrence pattern',
        choices: ['daily', 'weekly', 'monthly'],
        required: true,
      }),
      $.Var.new({
        name: 'interval',
        doc: 'repeat every N units',
        default: 1,
      }),
      $.Var.new({
        name: 'daysOfWeek',
        doc: 'for weekly: which days (0=Sun, 6=Sat)',
        default: () => [],
      }),
      $.Var.new({
        name: 'endDate',
        doc: 'optional end date for recurrence',
      }),
      $.Method.new({
        name: 'nextOccurrence',
        doc: 'calculate the next trigger time from a given date using UTC arithmetic',
        do(fromDate) {
          const TP = _.TimePolicy;
          let date = new Date(fromDate);

          if (this.endDate() && date > TP.endOfDay(this.endDate())) {
            return null;
          }

          switch (this.pattern()) {
            case 'daily':
              date = TP.addDays(date, this.interval());
              break;
            case 'weekly':
              if (this.daysOfWeek().length > 0) {
                const currentDay = TP.getDayOfWeek(date);
                const sortedDays = [...this.daysOfWeek()].sort((a, b) => a - b);
                const nextDay = sortedDays.find(d => d > currentDay);
                if (nextDay !== undefined) {
                  date = TP.addDays(date, nextDay - currentDay);
                } else {
                  const daysUntilFirst = 7 - currentDay + sortedDays[0];
                  date = TP.addDays(date, daysUntilFirst + 7 * (this.interval() - 1));
                }
              } else {
                date = TP.addWeeks(date, this.interval());
              }
              break;
            case 'monthly':
              date = TP.addMonths(date, this.interval());
              break;
          }

          if (this.endDate() && date > TP.endOfDay(this.endDate())) {
            return null;
          }

          return date;
        }
      }),
      $.Method.new({
        name: 'toJSON',
        do() {
          return {
            pattern: this.pattern(),
            interval: this.interval(),
            daysOfWeek: this.daysOfWeek(),
            endDate: this.endDate()?.toISOString(),
          };
        }
      }),
      $.Static.new({
        name: 'fromJSON',
        do(json) {
          return _.RecurrenceRule.new({
            pattern: json.pattern,
            interval: json.interval || 1,
            daysOfWeek: json.daysOfWeek || [],
            endDate: json.endDate ? new Date(json.endDate) : undefined,
          });
        }
      }),
    ]
  });
}.module({
  name: 'time',
  imports: [base],
}).load();
