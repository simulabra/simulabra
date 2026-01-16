import { __, base } from 'simulabra';
import test from 'simulabra/test';
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
}.module({
  name: 'test.time',
  imports: [base, test, time],
}).load();
