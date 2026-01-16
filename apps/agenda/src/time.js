import { __, base } from 'simulabra';

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
}.module({
  name: 'time',
  imports: [base],
}).load();
