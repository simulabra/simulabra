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

  const DAY_MAP = {
    sun: 0, sunday: 0,
    mon: 1, monday: 1,
    tue: 2, tuesday: 2,
    wed: 3, wednesday: 3,
    thu: 4, thursday: 4,
    fri: 5, friday: 5,
    sat: 6, saturday: 6,
  };

  $.Class.new({
    name: 'TimeOfDaySchedule',
    doc: 'Schedule that runs at specific times of day with optional day-of-week filtering',
    slots: [
      $.Var.new({
        name: 'times',
        doc: 'array of time strings like ["08:00", "18:00"]',
        default: () => [],
      }),
      $.Var.new({
        name: 'days',
        doc: 'optional array of day names like ["mon","tue","wed","thu","fri"] for weekdays only',
        default: () => [],
      }),
      $.Method.new({
        name: 'parseDays',
        doc: 'convert day name strings to numeric day-of-week values (0=Sunday)',
        do() {
          return this.days().map(d => {
            const normalized = d.toLowerCase();
            const num = DAY_MAP[normalized];
            if (num === undefined) {
              throw new Error(`Unknown day: ${d}`);
            }
            return num;
          });
        }
      }),
      $.Method.new({
        name: 'parseTimeInTimezone',
        doc: 'parse a time string and get the current time in a timezone',
        do(timeStr, timezone, now = new Date()) {
          const [hours, minutes] = timeStr.split(':').map(Number);

          const tz = timezone === 'local' ? Intl.DateTimeFormat().resolvedOptions().timeZone : timezone;

          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          });

          const parts = formatter.formatToParts(now);
          const getPart = (type) => parts.find(p => p.type === type)?.value;

          const nowInTz = {
            year: Number(getPart('year')),
            month: Number(getPart('month')) - 1,
            day: Number(getPart('day')),
            hour: Number(getPart('hour')),
            minute: Number(getPart('minute')),
            second: Number(getPart('second')),
          };

          return { hours, minutes, nowInTz, tz };
        }
      }),
      $.Method.new({
        name: 'nextOccurrence',
        doc: 'calculate the next Date when this schedule should run',
        do(now = new Date(), timezone = 'local') {
          const times = this.times();
          if (times.length === 0) {
            return null;
          }

          const dayFilter = this.days().length > 0 ? this.parseDays() : null;

          const candidates = [];
          for (const timeStr of times) {
            const { hours, minutes, nowInTz, tz } = this.parseTimeInTimezone(timeStr, timezone, now);

            for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
              const candidateDate = new Date(now);
              candidateDate.setDate(candidateDate.getDate() + dayOffset);

              const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: tz,
                weekday: 'short',
              });
              const dayName = formatter.format(candidateDate).toLowerCase();
              const dayNum = DAY_MAP[dayName.substring(0, 3)];

              if (dayFilter && !dayFilter.includes(dayNum)) {
                continue;
              }

              const targetStr = candidateDate.toLocaleDateString('en-CA', { timeZone: tz });
              const [year, month, day] = targetStr.split('-').map(Number);

              const tempDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));

              const tzOffset = this.getTimezoneOffset(tz, tempDate);
              const result = new Date(tempDate.getTime() + tzOffset);

              if (result > now) {
                candidates.push(result);
                break;
              }
            }
          }

          if (candidates.length === 0) {
            return null;
          }

          candidates.sort((a, b) => a - b);
          return candidates[0];
        }
      }),
      $.Method.new({
        name: 'getTimezoneOffset',
        doc: 'get offset in ms to convert UTC to target timezone (add to UTC to get local)',
        do(tz, date) {
          const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
          const tzStr = date.toLocaleString('en-US', { timeZone: tz });
          const utcDate = new Date(utcStr);
          const tzDate = new Date(tzStr);
          return utcDate - tzDate;
        }
      }),
    ]
  });

  $.Class.new({
    name: 'ScheduledJob',
    doc: 'A job that runs according to a schedule',
    slots: [
      $.Var.new({ name: 'jobName', doc: 'unique identifier for the job' }),
      $.Var.new({ name: 'schedule', doc: 'a Schedule object like TimeOfDaySchedule' }),
      $.Var.new({ name: 'action', doc: 'async function to execute' }),
      $.Var.new({ name: 'enabled', doc: 'when false, run() is a no-op', default: true }),
      $.Var.new({ name: 'lastRunAt', doc: 'last execution time' }),
      $.Var.new({ name: 'nextRunAt', doc: 'calculated next run time' }),
      $.Method.new({
        name: 'calculateNextRun',
        doc: 'calculate and store the next run time',
        do(timezone) {
          const next = this.schedule().nextOccurrence(new Date(), timezone);
          this.nextRunAt(next);
          return next;
        }
      }),
      $.Method.new({
        name: 'run',
        doc: 'execute the job action',
        async do() {
          if (!this.enabled()) return;
          this.lastRunAt(new Date());
          await this.action()();
        }
      }),
    ]
  });

  $.Class.new({
    name: 'Scheduler',
    doc: 'Manages scheduled jobs with timeout-based execution',
    slots: [
      $.Var.new({ name: 'jobs', default: () => new Map() }),
      $.Var.new({ name: 'timezone', default: 'local' }),
      $.Var.new({ name: 'running', default: false }),
      $.Var.new({ name: 'timers', default: () => new Map() }),
      $.Var.new({ name: 'logger', doc: 'optional logging function' }),
      $.Method.new({
        name: 'log',
        do(...args) {
          if (this.logger()) {
            this.logger()(...args);
          }
        }
      }),
      $.Method.new({
        name: 'register',
        doc: 'add a job to the scheduler',
        do(job) {
          this.jobs().set(job.jobName(), job);
          if (this.running()) {
            this.scheduleJob(job);
          }
          return this;
        }
      }),
      $.Method.new({
        name: 'unregister',
        doc: 'remove a job from the scheduler',
        do(jobName) {
          this.jobs().delete(jobName);
          const timer = this.timers().get(jobName);
          if (timer) {
            clearTimeout(timer);
            this.timers().delete(jobName);
          }
          return this;
        }
      }),
      $.Method.new({
        name: 'scheduleJob',
        doc: 'set up the timer for a single job, clearing any existing timer first',
        do(job) {
          const existingTimer = this.timers().get(job.jobName());
          if (existingTimer) {
            clearTimeout(existingTimer);
          }

          const next = job.calculateNextRun(this.timezone());
          if (!next) {
            this.log(`[scheduler] no next run time for job: ${job.jobName()}`);
            return;
          }

          const delay = next.getTime() - Date.now();
          if (delay < 0) {
            this.log(`[scheduler] next run time is in the past for job: ${job.jobName()}`);
            return;
          }

          this.log(`[scheduler] scheduling ${job.jobName()} for ${next.toISOString()} (in ${Math.round(delay / 1000)}s)`);

          const timer = setTimeout(async () => {
            if (!this.running()) return;
            try {
              this.log(`[scheduler] running job: ${job.jobName()}`);
              await job.run();
            } catch (e) {
              this.log(`[scheduler] error in job ${job.jobName()}:`, e.message);
            }
            this.scheduleJob(job);
          }, delay);

          this.timers().set(job.jobName(), timer);
        }
      }),
      $.Method.new({
        name: 'start',
        doc: 'begin scheduling all registered jobs',
        do() {
          if (this.running()) return;
          this.running(true);
          for (const job of this.jobs().values()) {
            this.scheduleJob(job);
          }
          this.log('[scheduler] started');
        }
      }),
      $.Method.new({
        name: 'stop',
        doc: 'stop all scheduled jobs',
        do() {
          this.running(false);
          for (const timer of this.timers().values()) {
            clearTimeout(timer);
          }
          this.timers().clear();
          this.log('[scheduler] stopped');
        }
      }),
    ]
  });

  $.Class.new({
    name: 'RecurrenceRule',
    doc: 'Rule for recurring events with daily, weekly, or monthly patterns',
    slots: [
      $.Var.new({
        name: 'pattern',
        doc: 'recurrence pattern',
        spec: $.$Enum.of('daily', 'weekly', 'monthly'),
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
