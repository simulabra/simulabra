import { __, base } from 'simulabra';
import db from 'simulabra/db';

export default await async function (_, $, $db) {
  const mod = __.mod();
  mod.def('DBVar', $db.DBVar);
  mod.def('Migration', $db.Migration);
  mod.def('MigrationRunner', $db.MigrationRunner);
  mod.def('SQLiteStream', $db.SQLiteStream);

  $.Class.new({
    name: 'SQLitePersisted',
    doc: 'Agenda-specific SQLitePersisted with agenda_ table prefix',
    slots: [
      $db.SQLitePersisted,
      $.Static.new({
        name: 'tableName',
        doc: 'table name with agenda prefix',
        do() {
          return 'agenda_' + this.name;
        }
      }),
    ]
  });

  const migration001 = $db.Migration.new({
    name: '001_create_tables',
    version: '001',
    description: 'Create Log, Task, Reminder tables',
    up(db) {
      db.query(`CREATE TABLE IF NOT EXISTS agenda_Log (
        sid TEXT PRIMARY KEY,
        content TEXT,
        timestamp TEXT,
        tags TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )`).run();
      db.query(`CREATE TABLE IF NOT EXISTS agenda_Task (
        sid TEXT PRIMARY KEY,
        title TEXT,
        done TEXT,
        priority TEXT,
        dueDate TEXT,
        completedAt TEXT,
        tags TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )`).run();
      db.query(`CREATE TABLE IF NOT EXISTS agenda_Reminder (
        sid TEXT PRIMARY KEY,
        message TEXT,
        triggerAt TEXT,
        recurrence TEXT,
        sent TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )`).run();
    },
    down(db) {
      db.query(`DROP TABLE IF EXISTS agenda_Log`).run();
      db.query(`DROP TABLE IF EXISTS agenda_Task`).run();
      db.query(`DROP TABLE IF EXISTS agenda_Reminder`).run();
    }
  });

  const migration002 = $db.Migration.new({
    name: '002_create_indexes',
    version: '002',
    description: 'Create secondary indexes for indexed fields',
    up(db) {
      db.query(`CREATE INDEX IF NOT EXISTS idx_agenda_Log_timestamp ON agenda_Log (timestamp)`).run();
      db.query(`CREATE INDEX IF NOT EXISTS idx_agenda_Task_done ON agenda_Task (done)`).run();
      db.query(`CREATE INDEX IF NOT EXISTS idx_agenda_Task_priority ON agenda_Task (priority)`).run();
      db.query(`CREATE INDEX IF NOT EXISTS idx_agenda_Task_dueDate ON agenda_Task (dueDate)`).run();
      db.query(`CREATE INDEX IF NOT EXISTS idx_agenda_Reminder_triggerAt ON agenda_Reminder (triggerAt)`).run();
      db.query(`CREATE INDEX IF NOT EXISTS idx_agenda_Reminder_sent ON agenda_Reminder (sent)`).run();
    },
    down(db) {
      db.query(`DROP INDEX IF EXISTS idx_agenda_Log_timestamp`).run();
      db.query(`DROP INDEX IF EXISTS idx_agenda_Task_done`).run();
      db.query(`DROP INDEX IF EXISTS idx_agenda_Task_priority`).run();
      db.query(`DROP INDEX IF EXISTS idx_agenda_Task_dueDate`).run();
      db.query(`DROP INDEX IF EXISTS idx_agenda_Reminder_triggerAt`).run();
      db.query(`DROP INDEX IF EXISTS idx_agenda_Reminder_sent`).run();
    }
  });

  const migration003 = $db.Migration.new({
    name: '003_create_fts',
    version: '003',
    description: 'Create FTS5 virtual tables for full-text search',
    up(db) {
      db.query(`CREATE VIRTUAL TABLE IF NOT EXISTS agenda_Log_fts USING fts5(sid, content, content='agenda_Log', content_rowid='rowid')`).run();
      db.query(`CREATE VIRTUAL TABLE IF NOT EXISTS agenda_Task_fts USING fts5(sid, title, content='agenda_Task', content_rowid='rowid')`).run();
      db.query(`CREATE VIRTUAL TABLE IF NOT EXISTS agenda_Reminder_fts USING fts5(sid, message, content='agenda_Reminder', content_rowid='rowid')`).run();

      // Triggers for Log
      db.query(`CREATE TRIGGER IF NOT EXISTS agenda_Log_fts_ai AFTER INSERT ON agenda_Log BEGIN
        INSERT INTO agenda_Log_fts(rowid, sid, content) VALUES (NEW.rowid, NEW.sid, NEW.content);
      END`).run();
      db.query(`CREATE TRIGGER IF NOT EXISTS agenda_Log_fts_ad AFTER DELETE ON agenda_Log BEGIN
        INSERT INTO agenda_Log_fts(agenda_Log_fts, rowid, sid, content) VALUES ('delete', OLD.rowid, OLD.sid, OLD.content);
      END`).run();
      db.query(`CREATE TRIGGER IF NOT EXISTS agenda_Log_fts_au AFTER UPDATE ON agenda_Log BEGIN
        INSERT INTO agenda_Log_fts(agenda_Log_fts, rowid, sid, content) VALUES ('delete', OLD.rowid, OLD.sid, OLD.content);
        INSERT INTO agenda_Log_fts(rowid, sid, content) VALUES (NEW.rowid, NEW.sid, NEW.content);
      END`).run();

      // Triggers for Task
      db.query(`CREATE TRIGGER IF NOT EXISTS agenda_Task_fts_ai AFTER INSERT ON agenda_Task BEGIN
        INSERT INTO agenda_Task_fts(rowid, sid, title) VALUES (NEW.rowid, NEW.sid, NEW.title);
      END`).run();
      db.query(`CREATE TRIGGER IF NOT EXISTS agenda_Task_fts_ad AFTER DELETE ON agenda_Task BEGIN
        INSERT INTO agenda_Task_fts(agenda_Task_fts, rowid, sid, title) VALUES ('delete', OLD.rowid, OLD.sid, OLD.title);
      END`).run();
      db.query(`CREATE TRIGGER IF NOT EXISTS agenda_Task_fts_au AFTER UPDATE ON agenda_Task BEGIN
        INSERT INTO agenda_Task_fts(agenda_Task_fts, rowid, sid, title) VALUES ('delete', OLD.rowid, OLD.sid, OLD.title);
        INSERT INTO agenda_Task_fts(rowid, sid, title) VALUES (NEW.rowid, NEW.sid, NEW.title);
      END`).run();

      // Triggers for Reminder
      db.query(`CREATE TRIGGER IF NOT EXISTS agenda_Reminder_fts_ai AFTER INSERT ON agenda_Reminder BEGIN
        INSERT INTO agenda_Reminder_fts(rowid, sid, message) VALUES (NEW.rowid, NEW.sid, NEW.message);
      END`).run();
      db.query(`CREATE TRIGGER IF NOT EXISTS agenda_Reminder_fts_ad AFTER DELETE ON agenda_Reminder BEGIN
        INSERT INTO agenda_Reminder_fts(agenda_Reminder_fts, rowid, sid, message) VALUES ('delete', OLD.rowid, OLD.sid, OLD.message);
      END`).run();
      db.query(`CREATE TRIGGER IF NOT EXISTS agenda_Reminder_fts_au AFTER UPDATE ON agenda_Reminder BEGIN
        INSERT INTO agenda_Reminder_fts(agenda_Reminder_fts, rowid, sid, message) VALUES ('delete', OLD.rowid, OLD.sid, OLD.message);
        INSERT INTO agenda_Reminder_fts(rowid, sid, message) VALUES (NEW.rowid, NEW.sid, NEW.message);
      END`).run();
    },
    down(db) {
      db.query(`DROP TRIGGER IF EXISTS agenda_Log_fts_ai`).run();
      db.query(`DROP TRIGGER IF EXISTS agenda_Log_fts_ad`).run();
      db.query(`DROP TRIGGER IF EXISTS agenda_Log_fts_au`).run();
      db.query(`DROP TRIGGER IF EXISTS agenda_Task_fts_ai`).run();
      db.query(`DROP TRIGGER IF EXISTS agenda_Task_fts_ad`).run();
      db.query(`DROP TRIGGER IF EXISTS agenda_Task_fts_au`).run();
      db.query(`DROP TRIGGER IF EXISTS agenda_Reminder_fts_ai`).run();
      db.query(`DROP TRIGGER IF EXISTS agenda_Reminder_fts_ad`).run();
      db.query(`DROP TRIGGER IF EXISTS agenda_Reminder_fts_au`).run();
      db.query(`DROP TABLE IF EXISTS agenda_Log_fts`).run();
      db.query(`DROP TABLE IF EXISTS agenda_Task_fts`).run();
      db.query(`DROP TABLE IF EXISTS agenda_Reminder_fts`).run();
    }
  });

  const migration004 = $db.Migration.new({
    name: '004_create_streams',
    version: '004',
    description: 'Create _streams table for chat/events',
    up(db) {
      db.query(`CREATE TABLE IF NOT EXISTS _streams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        streamName TEXT NOT NULL,
        entryId TEXT NOT NULL,
        data TEXT NOT NULL,
        createdAt TEXT NOT NULL
      )`).run();
      db.query(`CREATE INDEX IF NOT EXISTS idx_streams_name_id ON _streams (streamName, id)`).run();
    },
    down(db) {
      db.query(`DROP INDEX IF EXISTS idx_streams_name_id`).run();
      db.query(`DROP TABLE IF EXISTS _streams`).run();
    }
  });

  const migration005 = $db.Migration.new({
    name: '005_create_prompts',
    version: '005',
    description: 'Create Prompt and PromptConfig tables for proactive prompting',
    up(db) {
      db.query(`CREATE TABLE IF NOT EXISTS agenda_Prompt (
        sid TEXT PRIMARY KEY,
        itemType TEXT,
        itemId TEXT,
        message TEXT,
        context TEXT,
        status TEXT,
        action TEXT,
        generatedAt TEXT,
        shownAt TEXT,
        actionedAt TEXT,
        snoozeUntil TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )`).run();
      db.query(`CREATE INDEX IF NOT EXISTS idx_agenda_Prompt_itemType ON agenda_Prompt (itemType)`).run();
      db.query(`CREATE INDEX IF NOT EXISTS idx_agenda_Prompt_status ON agenda_Prompt (status)`).run();
      db.query(`CREATE INDEX IF NOT EXISTS idx_agenda_Prompt_generatedAt ON agenda_Prompt (generatedAt)`).run();

      db.query(`CREATE VIRTUAL TABLE IF NOT EXISTS agenda_Prompt_fts USING fts5(sid, message, content='agenda_Prompt', content_rowid='rowid')`).run();
      db.query(`CREATE TRIGGER IF NOT EXISTS agenda_Prompt_fts_ai AFTER INSERT ON agenda_Prompt BEGIN
        INSERT INTO agenda_Prompt_fts(rowid, sid, message) VALUES (NEW.rowid, NEW.sid, NEW.message);
      END`).run();
      db.query(`CREATE TRIGGER IF NOT EXISTS agenda_Prompt_fts_ad AFTER DELETE ON agenda_Prompt BEGIN
        INSERT INTO agenda_Prompt_fts(agenda_Prompt_fts, rowid, sid, message) VALUES ('delete', OLD.rowid, OLD.sid, OLD.message);
      END`).run();
      db.query(`CREATE TRIGGER IF NOT EXISTS agenda_Prompt_fts_au AFTER UPDATE ON agenda_Prompt BEGIN
        INSERT INTO agenda_Prompt_fts(agenda_Prompt_fts, rowid, sid, message) VALUES ('delete', OLD.rowid, OLD.sid, OLD.message);
        INSERT INTO agenda_Prompt_fts(rowid, sid, message) VALUES (NEW.rowid, NEW.sid, NEW.message);
      END`).run();

      db.query(`CREATE TABLE IF NOT EXISTS agenda_PromptConfig (
        sid TEXT PRIMARY KEY,
        key TEXT UNIQUE,
        promptFrequencyHours TEXT,
        maxPromptsPerCycle TEXT,
        taskStalenessDays TEXT,
        lastGenerationAt TEXT,
        responseHistory TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )`).run();
    },
    down(db) {
      db.query(`DROP TRIGGER IF EXISTS agenda_Prompt_fts_ai`).run();
      db.query(`DROP TRIGGER IF EXISTS agenda_Prompt_fts_ad`).run();
      db.query(`DROP TRIGGER IF EXISTS agenda_Prompt_fts_au`).run();
      db.query(`DROP TABLE IF EXISTS agenda_Prompt_fts`).run();
      db.query(`DROP INDEX IF EXISTS idx_agenda_Prompt_itemType`).run();
      db.query(`DROP INDEX IF EXISTS idx_agenda_Prompt_status`).run();
      db.query(`DROP INDEX IF EXISTS idx_agenda_Prompt_generatedAt`).run();
      db.query(`DROP TABLE IF EXISTS agenda_Prompt`).run();
      db.query(`DROP TABLE IF EXISTS agenda_PromptConfig`).run();
    }
  });

  const migration006 = $db.Migration.new({
    name: '006_create_projects',
    version: '006',
    description: 'Create Project table and add projectId to Task, Log, Reminder',
    up(db) {
      db.query(`CREATE TABLE IF NOT EXISTS agenda_Project (
        sid TEXT PRIMARY KEY,
        title TEXT,
        slug TEXT,
        archived TEXT,
        context TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )`).run();

      db.query(`CREATE INDEX IF NOT EXISTS idx_agenda_Project_archived ON agenda_Project (archived)`).run();
      db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_agenda_Project_slug ON agenda_Project (slug)`).run();

      db.query(`CREATE VIRTUAL TABLE IF NOT EXISTS agenda_Project_fts USING fts5(sid, title, content='agenda_Project', content_rowid='rowid')`).run();
      db.query(`CREATE TRIGGER IF NOT EXISTS agenda_Project_fts_ai AFTER INSERT ON agenda_Project BEGIN
        INSERT INTO agenda_Project_fts(rowid, sid, title) VALUES (NEW.rowid, NEW.sid, NEW.title);
      END`).run();
      db.query(`CREATE TRIGGER IF NOT EXISTS agenda_Project_fts_ad AFTER DELETE ON agenda_Project BEGIN
        INSERT INTO agenda_Project_fts(agenda_Project_fts, rowid, sid, title) VALUES ('delete', OLD.rowid, OLD.sid, OLD.title);
      END`).run();
      db.query(`CREATE TRIGGER IF NOT EXISTS agenda_Project_fts_au AFTER UPDATE ON agenda_Project BEGIN
        INSERT INTO agenda_Project_fts(agenda_Project_fts, rowid, sid, title) VALUES ('delete', OLD.rowid, OLD.sid, OLD.title);
        INSERT INTO agenda_Project_fts(rowid, sid, title) VALUES (NEW.rowid, NEW.sid, NEW.title);
      END`).run();

      db.query(`ALTER TABLE agenda_Task ADD COLUMN projectId TEXT`).run();
      db.query(`ALTER TABLE agenda_Log ADD COLUMN projectId TEXT`).run();
      db.query(`ALTER TABLE agenda_Reminder ADD COLUMN projectId TEXT`).run();

      db.query(`CREATE INDEX IF NOT EXISTS idx_agenda_Task_projectId ON agenda_Task (projectId)`).run();
      db.query(`CREATE INDEX IF NOT EXISTS idx_agenda_Log_projectId ON agenda_Log (projectId)`).run();
      db.query(`CREATE INDEX IF NOT EXISTS idx_agenda_Reminder_projectId ON agenda_Reminder (projectId)`).run();
    },
    down(db) {
      db.query(`DROP TRIGGER IF EXISTS agenda_Project_fts_ai`).run();
      db.query(`DROP TRIGGER IF EXISTS agenda_Project_fts_ad`).run();
      db.query(`DROP TRIGGER IF EXISTS agenda_Project_fts_au`).run();
      db.query(`DROP TABLE IF EXISTS agenda_Project_fts`).run();
      db.query(`DROP INDEX IF EXISTS idx_agenda_Project_archived`).run();
      db.query(`DROP INDEX IF EXISTS idx_agenda_Project_slug`).run();
      db.query(`DROP INDEX IF EXISTS idx_agenda_Task_projectId`).run();
      db.query(`DROP INDEX IF EXISTS idx_agenda_Log_projectId`).run();
      db.query(`DROP INDEX IF EXISTS idx_agenda_Reminder_projectId`).run();
      db.query(`DROP TABLE IF EXISTS agenda_Project`).run();
    }
  });

  $.Class.new({
    name: 'AgendaMigrations',
    doc: 'Helper class to get agenda migrations',
    slots: [
      $.Static.new({
        name: 'all',
        doc: 'get all agenda migrations in order',
        do() {
          return [migration001, migration002, migration003, migration004, migration005, migration006];
        }
      }),
    ]
  });
}.module({
  name: 'sqlite',
  imports: [base, db],
}).load();
