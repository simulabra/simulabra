import { __, base } from '../src/base.js';
import test from '../src/test.js';
import time from '../src/time.js';

export default await async function (_, $, $test, $time) {
  const TP = $time.TimePolicy;

  $test.Case.new({
    name: 'TimePolicyAddDays',
    doc: 'addDays should use UTC arithmetic consistently',
    do() {
      const date = new Date('2025-01-15T10:30:00Z');
      const result = TP.addDays(date, 5);
      this.assertEq(result.getUTCDate(), 20);
      this.assertEq(result.getUTCHours(), 10);
      this.assertEq(result.getUTCMinutes(), 30);
    }
  });

  $test.Case.new({
    name: 'TimePolicyAddDaysNegative',
    doc: 'addDays should handle negative values',
    do() {
      const date = new Date('2025-01-15T10:30:00Z');
      const result = TP.addDays(date, -5);
      this.assertEq(result.getUTCDate(), 10);
    }
  });

  $test.Case.new({
    name: 'TimePolicyAddDaysMonthBoundary',
    doc: 'addDays should cross month boundaries correctly',
    do() {
      const date = new Date('2025-01-30T12:00:00Z');
      const result = TP.addDays(date, 5);
      this.assertEq(result.getUTCMonth(), 1); // February
      this.assertEq(result.getUTCDate(), 4);
    }
  });

  $test.Case.new({
    name: 'TimePolicyAddWeeks',
    doc: 'addWeeks should add correct number of days',
    do() {
      const date = new Date('2025-01-15T10:30:00Z');
      const result = TP.addWeeks(date, 2);
      this.assertEq(result.getUTCDate(), 29);
      this.assertEq(result.getUTCMonth(), 0); // January
    }
  });

  $test.Case.new({
    name: 'TimePolicyAddMonths',
    doc: 'addMonths should advance by months',
    do() {
      const date = new Date('2025-01-15T10:30:00Z');
      const result = TP.addMonths(date, 3);
      this.assertEq(result.getUTCMonth(), 3); // April
      this.assertEq(result.getUTCDate(), 15);
    }
  });

  $test.Case.new({
    name: 'TimePolicyAddMonthsYearBoundary',
    doc: 'addMonths should cross year boundaries',
    do() {
      const date = new Date('2025-11-15T10:30:00Z');
      const result = TP.addMonths(date, 3);
      this.assertEq(result.getUTCFullYear(), 2026);
      this.assertEq(result.getUTCMonth(), 1); // February
    }
  });

  $test.Case.new({
    name: 'TimePolicyAddMonthsOverflow',
    doc: 'addMonths should handle month-end overflow (Jan 31 + 1 month)',
    do() {
      const date = new Date('2025-01-31T10:30:00Z');
      const result = TP.addMonths(date, 1);
      // JavaScript Date behavior: Jan 31 + 1 month = March 3 (31 days overflow)
      this.assertEq(result.getUTCMonth(), 2); // March
    }
  });

  $test.Case.new({
    name: 'TimePolicyGetDayOfWeek',
    doc: 'getDayOfWeek should return UTC day',
    do() {
      // 2025-01-15 is a Wednesday (day 3)
      const date = new Date('2025-01-15T10:30:00Z');
      this.assertEq(TP.getDayOfWeek(date), 3);
    }
  });

  $test.Case.new({
    name: 'TimePolicyGetDayOfWeekNearMidnight',
    doc: 'getDayOfWeek should be consistent near midnight UTC',
    do() {
      // 2025-01-15 23:59 UTC is still Wednesday
      const lateWed = new Date('2025-01-15T23:59:00Z');
      this.assertEq(TP.getDayOfWeek(lateWed), 3);

      // 2025-01-16 00:01 UTC is Thursday
      const earlyThu = new Date('2025-01-16T00:01:00Z');
      this.assertEq(TP.getDayOfWeek(earlyThu), 4);
    }
  });

  $test.Case.new({
    name: 'TimePolicyEndOfDay',
    doc: 'endOfDay should return 23:59:59.999 UTC',
    do() {
      const date = new Date('2025-01-15T10:30:00Z');
      const end = TP.endOfDay(date);
      this.assertEq(end.getUTCHours(), 23);
      this.assertEq(end.getUTCMinutes(), 59);
      this.assertEq(end.getUTCSeconds(), 59);
      this.assertEq(end.getUTCMilliseconds(), 999);
      this.assertEq(end.getUTCDate(), 15);
    }
  });

  $test.Case.new({
    name: 'TimePolicyStartOfDay',
    doc: 'startOfDay should return 00:00:00.000 UTC',
    do() {
      const date = new Date('2025-01-15T22:30:00Z');
      const start = TP.startOfDay(date);
      this.assertEq(start.getUTCHours(), 0);
      this.assertEq(start.getUTCMinutes(), 0);
      this.assertEq(start.getUTCSeconds(), 0);
      this.assertEq(start.getUTCMilliseconds(), 0);
      this.assertEq(start.getUTCDate(), 15);
    }
  });

  $test.Case.new({
    name: 'TimePolicyIsSameDay',
    doc: 'isSameDay should compare UTC days',
    do() {
      const morning = new Date('2025-01-15T06:00:00Z');
      const evening = new Date('2025-01-15T22:00:00Z');
      const nextDay = new Date('2025-01-16T06:00:00Z');

      this.assert(TP.isSameDay(morning, evening), 'same day different times');
      this.assert(!TP.isSameDay(morning, nextDay), 'different days');
    }
  });

  $test.Case.new({
    name: 'TimePolicyIsAfterDay',
    doc: 'isAfterDay should compare full UTC days',
    do() {
      const jan15Morning = new Date('2025-01-15T06:00:00Z');
      const jan15Evening = new Date('2025-01-15T22:00:00Z');
      const jan16Morning = new Date('2025-01-16T06:00:00Z');

      this.assert(!TP.isAfterDay(jan15Evening, jan15Morning), 'same day not after');
      this.assert(TP.isAfterDay(jan16Morning, jan15Evening), 'next day is after');
    }
  });

  $test.Case.new({
    name: 'TimePolicyDSTSpringForward',
    doc: 'UTC arithmetic should be unaffected by DST spring forward',
    do() {
      // US DST 2025 starts March 9 at 2am local
      // In UTC, this should not affect our calculations
      const beforeDST = new Date('2025-03-08T10:00:00Z');
      const result = TP.addDays(beforeDST, 3);

      // Should be exactly 3 days later in UTC
      this.assertEq(result.getUTCDate(), 11);
      this.assertEq(result.getUTCHours(), 10);
      this.assertEq(result.getUTCMinutes(), 0);
    }
  });

  $test.Case.new({
    name: 'TimePolicyDSTFallBack',
    doc: 'UTC arithmetic should be unaffected by DST fall back',
    do() {
      // US DST 2025 ends November 2 at 2am local
      // In UTC, this should not affect our calculations
      const beforeDSTEnd = new Date('2025-11-01T10:00:00Z');
      const result = TP.addDays(beforeDSTEnd, 3);

      // Should be exactly 3 days later in UTC
      this.assertEq(result.getUTCDate(), 4);
      this.assertEq(result.getUTCHours(), 10);
    }
  });

  $test.Case.new({
    name: 'TimePolicyWeeklyAcrossDSTBoundary',
    doc: 'Weekly addition should work correctly across DST boundary',
    do() {
      // Before DST spring forward
      const beforeDST = new Date('2025-03-05T14:00:00Z'); // Wednesday
      const result = TP.addWeeks(beforeDST, 1);

      // Should be exactly 7 days later
      this.assertEq(result.getUTCDate(), 12);
      this.assertEq(result.getUTCHours(), 14);
      this.assertEq(TP.getDayOfWeek(result), 3); // Still Wednesday
    }
  });

  $test.Case.new({
    name: 'TimePolicyLeapYear',
    doc: 'Date arithmetic should handle leap years correctly',
    do() {
      // 2024 is a leap year
      const feb28 = new Date('2024-02-28T12:00:00Z');
      const result = TP.addDays(feb28, 1);
      this.assertEq(result.getUTCDate(), 29);
      this.assertEq(result.getUTCMonth(), 1); // Still February

      const feb29 = new Date('2024-02-29T12:00:00Z');
      const march1 = TP.addDays(feb29, 1);
      this.assertEq(march1.getUTCDate(), 1);
      this.assertEq(march1.getUTCMonth(), 2); // March
    }
  });

  $test.Case.new({
    name: 'TimePolicyNonLeapYear',
    doc: 'Date arithmetic should handle non-leap years correctly',
    do() {
      // 2025 is not a leap year
      const feb28 = new Date('2025-02-28T12:00:00Z');
      const result = TP.addDays(feb28, 1);
      this.assertEq(result.getUTCDate(), 1);
      this.assertEq(result.getUTCMonth(), 2); // March
    }
  });

  $test.Case.new({
    name: 'TimePolicyYearEnd',
    doc: 'Date arithmetic should handle year boundaries',
    do() {
      const dec31 = new Date('2025-12-31T23:00:00Z');
      const jan1 = TP.addDays(dec31, 1);
      this.assertEq(jan1.getUTCFullYear(), 2026);
      this.assertEq(jan1.getUTCMonth(), 0);
      this.assertEq(jan1.getUTCDate(), 1);
    }
  });

  // RecurrenceRule tests

  $test.Case.new({
    name: 'RecurrenceRuleDaily',
    doc: 'Daily recurrence should add interval days',
    do() {
      const rule = $time.RecurrenceRule.new({ pattern: 'daily', interval: 1 });
      const start = new Date('2025-01-15T09:00:00Z');
      const next = rule.nextOccurrence(start);
      this.assertEq(next.getUTCDate(), 16);
      this.assertEq(next.getUTCHours(), 9);
    }
  });

  $test.Case.new({
    name: 'RecurrenceRuleDailyInterval',
    doc: 'Daily recurrence with interval > 1 should skip days',
    do() {
      const rule = $time.RecurrenceRule.new({ pattern: 'daily', interval: 3 });
      const start = new Date('2025-01-15T09:00:00Z');
      const next = rule.nextOccurrence(start);
      this.assertEq(next.getUTCDate(), 18);
    }
  });

  $test.Case.new({
    name: 'RecurrenceRuleWeekly',
    doc: 'Weekly recurrence without specific days should add weeks',
    do() {
      const rule = $time.RecurrenceRule.new({ pattern: 'weekly', interval: 1 });
      const start = new Date('2025-01-15T09:00:00Z'); // Wednesday
      const next = rule.nextOccurrence(start);
      this.assertEq(next.getUTCDate(), 22);
      this.assertEq(TP.getDayOfWeek(next), 3); // Still Wednesday
    }
  });

  $test.Case.new({
    name: 'RecurrenceRuleWeeklyWithDays',
    doc: 'Weekly recurrence with specific days should find next matching day',
    do() {
      // Wednesday, looking for Mon(1), Fri(5)
      const rule = $time.RecurrenceRule.new({ pattern: 'weekly', daysOfWeek: [1, 5] });
      const wed = new Date('2025-01-15T09:00:00Z'); // Wednesday (day 3)
      const next = rule.nextOccurrence(wed);
      this.assertEq(next.getUTCDate(), 17); // Friday
      this.assertEq(TP.getDayOfWeek(next), 5);
    }
  });

  $test.Case.new({
    name: 'RecurrenceRuleWeeklyWrapAround',
    doc: 'Weekly recurrence should wrap to next week when past all days',
    do() {
      // Saturday, looking for Mon(1), Wed(3)
      const rule = $time.RecurrenceRule.new({ pattern: 'weekly', daysOfWeek: [1, 3] });
      const sat = new Date('2025-01-18T09:00:00Z'); // Saturday (day 6)
      const next = rule.nextOccurrence(sat);
      this.assertEq(next.getUTCDate(), 20); // Monday next week
      this.assertEq(TP.getDayOfWeek(next), 1);
    }
  });

  $test.Case.new({
    name: 'RecurrenceRuleWeeklyIntervalWrap',
    doc: 'Weekly with interval > 1 should skip weeks on wrap',
    do() {
      const rule = $time.RecurrenceRule.new({ pattern: 'weekly', interval: 2, daysOfWeek: [1] }); // Mon, every 2 weeks
      const sat = new Date('2025-01-18T09:00:00Z'); // Saturday
      const next = rule.nextOccurrence(sat);
      // Should wrap to Monday, but skip 1 week (interval - 1)
      this.assertEq(next.getUTCDate(), 27); // Monday, 2 weeks ahead
    }
  });

  $test.Case.new({
    name: 'RecurrenceRuleMonthly',
    doc: 'Monthly recurrence should add months',
    do() {
      const rule = $time.RecurrenceRule.new({ pattern: 'monthly', interval: 1 });
      const start = new Date('2025-01-15T09:00:00Z');
      const next = rule.nextOccurrence(start);
      this.assertEq(next.getUTCMonth(), 1); // February
      this.assertEq(next.getUTCDate(), 15);
    }
  });

  $test.Case.new({
    name: 'RecurrenceRuleMonthlyInterval',
    doc: 'Monthly recurrence with interval should skip months',
    do() {
      const rule = $time.RecurrenceRule.new({ pattern: 'monthly', interval: 3 });
      const start = new Date('2025-01-15T09:00:00Z');
      const next = rule.nextOccurrence(start);
      this.assertEq(next.getUTCMonth(), 3); // April
    }
  });

  $test.Case.new({
    name: 'RecurrenceRuleEndDateRespected',
    doc: 'Recurrence should return null when result would exceed endDate',
    do() {
      const rule = $time.RecurrenceRule.new({
        pattern: 'daily',
        interval: 1,
        endDate: new Date('2025-01-17T23:59:59Z'),
      });
      const start = new Date('2025-01-17T09:00:00Z');
      const next = rule.nextOccurrence(start);
      this.assertEq(next, null); // Jan 18 would exceed endDate
    }
  });

  $test.Case.new({
    name: 'RecurrenceRuleEndDateAllows',
    doc: 'Recurrence should allow dates within endDate',
    do() {
      const rule = $time.RecurrenceRule.new({
        pattern: 'daily',
        interval: 1,
        endDate: new Date('2025-01-20T00:00:00Z'),
      });
      const start = new Date('2025-01-17T09:00:00Z');
      const next = rule.nextOccurrence(start);
      this.assertEq(next.getUTCDate(), 18); // Jan 18 is within endDate
    }
  });

  $test.Case.new({
    name: 'RecurrenceRuleStartPastEndDate',
    doc: 'Recurrence should return null when fromDate is past endDate',
    do() {
      const rule = $time.RecurrenceRule.new({
        pattern: 'daily',
        endDate: new Date('2025-01-15T00:00:00Z'),
      });
      const start = new Date('2025-01-16T09:00:00Z');
      const next = rule.nextOccurrence(start);
      this.assertEq(next, null);
    }
  });

  $test.Case.new({
    name: 'RecurrenceRuleToJSON',
    doc: 'toJSON should serialize all fields',
    do() {
      const endDate = new Date('2025-06-01T00:00:00Z');
      const rule = $time.RecurrenceRule.new({
        pattern: 'weekly',
        interval: 2,
        daysOfWeek: [1, 3, 5],
        endDate,
      });
      const json = rule.toJSON();
      this.assertEq(json.pattern, 'weekly');
      this.assertEq(json.interval, 2);
      this.assertEq(json.daysOfWeek.length, 3);
      this.assertEq(json.daysOfWeek[0], 1);
      this.assertEq(json.endDate, endDate.toISOString());
    }
  });

  $test.Case.new({
    name: 'RecurrenceRuleFromJSON',
    doc: 'fromJSON should deserialize correctly',
    do() {
      const json = {
        pattern: 'monthly',
        interval: 3,
        daysOfWeek: [],
        endDate: '2025-12-31T00:00:00.000Z',
      };
      const rule = $time.RecurrenceRule.fromJSON(json);
      this.assertEq(rule.pattern(), 'monthly');
      this.assertEq(rule.interval(), 3);
      this.assertEq(rule.daysOfWeek().length, 0);
      this.assertEq(rule.endDate().getUTCFullYear(), 2025);
      this.assertEq(rule.endDate().getUTCMonth(), 11);
    }
  });

  $test.Case.new({
    name: 'RecurrenceRuleFromJSONDefaults',
    doc: 'fromJSON should apply defaults for missing fields',
    do() {
      const json = { pattern: 'daily' };
      const rule = $time.RecurrenceRule.fromJSON(json);
      this.assertEq(rule.interval(), 1);
      this.assertEq(rule.daysOfWeek().length, 0);
      this.assertEq(rule.endDate(), undefined);
    }
  });

  $test.Case.new({
    name: 'RecurrenceRuleRoundTrip',
    doc: 'toJSON -> fromJSON should preserve all values',
    do() {
      const original = $time.RecurrenceRule.new({
        pattern: 'weekly',
        interval: 2,
        daysOfWeek: [0, 2, 4],
        endDate: new Date('2025-12-31T12:00:00Z'),
      });
      const restored = $time.RecurrenceRule.fromJSON(original.toJSON());
      this.assertEq(restored.pattern(), original.pattern());
      this.assertEq(restored.interval(), original.interval());
      this.assertEq(restored.daysOfWeek().length, original.daysOfWeek().length);
      this.assertEq(restored.endDate().getTime(), original.endDate().getTime());
    }
  });
}.module({
  name: 'test.time',
  imports: [base, test, time],
}).load();
