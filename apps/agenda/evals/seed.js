import { __, base } from 'simulabra';

export default await async function (_, $) {
  $.Class.new({
    name: 'EvalSeed',
    doc: 'Deterministic database seeding for eval scenarios',
    slots: [
      $.Static.new({
        name: 'populate',
        doc: 'seed an in-memory database with realistic data via DatabaseService CRUD methods',
        async do(dbService) {
          const now = new Date();
          const dayMs = 24 * 60 * 60 * 1000;

          const projects = {};
          projects.house = await dbService.createProject({
            title: 'House Renovation',
            slug: 'house',
            context: 'Kitchen remodel and bathroom update. Budget: $15k.',
          });
          projects.sideProject = await dbService.createProject({
            title: 'Side Project',
            slug: 'side-project',
            context: 'Building a recipe tracker web app in Simulabra.',
          });
          projects.fitness = await dbService.createProject({
            title: 'Fitness',
            slug: 'fitness',
            context: 'Training for a half marathon in June.',
          });

          const tasks = {};
          tasks.researchCountertops = await dbService.createTask({
            title: 'Research countertop materials',
            priority: 2,
            projectId: projects.house.id,
          });
          tasks.getPlumberQuote = await dbService.createTask({
            title: 'Get plumber quote',
            priority: 1,
            dueDate: new Date(now.getTime() + 2 * dayMs).toISOString(),
            projectId: projects.house.id,
          });
          tasks.pickPaintColors = await dbService.createTask({
            title: 'Pick paint colors',
            priority: 3,
            projectId: projects.house.id,
          });
          const orderCabinet = await dbService.createTask({
            title: 'Order cabinet hardware',
            priority: 4,
            projectId: projects.house.id,
          });
          tasks.orderCabinetHardware = await dbService.completeTask({ id: orderCabinet.id });

          const setupSchema = await dbService.createTask({
            title: 'Set up database schema',
            priority: 2,
            projectId: projects.sideProject.id,
          });
          tasks.setupDatabaseSchema = await dbService.completeTask({ id: setupSchema.id });
          tasks.buildRecipeForm = await dbService.createTask({
            title: 'Build recipe input form',
            priority: 2,
            projectId: projects.sideProject.id,
          });
          tasks.addSearch = await dbService.createTask({
            title: 'Add search functionality',
            priority: 3,
            projectId: projects.sideProject.id,
          });

          tasks.planWorkout = await dbService.createTask({
            title: 'Plan workout schedule',
            priority: 3,
            tags: ['planning'],
            projectId: projects.fitness.id,
          });
          tasks.buyShoes = await dbService.createTask({
            title: 'Buy running shoes',
            priority: 2,
            projectId: projects.fitness.id,
          });

          tasks.callDentist = await dbService.createTask({
            title: 'Call dentist',
            priority: 3,
          });
          tasks.renewRegistration = await dbService.createTask({
            title: 'Renew car registration',
            priority: 1,
            dueDate: new Date(now.getTime() - 1 * dayMs).toISOString(),
          });
          tasks.readDocs = await dbService.createTask({
            title: 'Read simulabra docs',
            priority: 4,
          });

          const logs = {};
          logs.contractor = await dbService.createLog({
            content: 'Met with contractor, decided on quartz countertops for kitchen island',
            projectId: projects.house.id,
          });
          logs.tileSamples = await dbService.createLog({
            content: 'Bathroom tile samples arrived — prefer the grey slate',
            projectId: projects.house.id,
          });
          logs.dataModel = await dbService.createLog({
            content: 'Sketched out the data model: recipes have ingredients, steps, tags',
            projectId: projects.sideProject.id,
          });
          logs.distributed = await dbService.createLog({
            content: 'Interesting talk on distributed systems at the meetup',
          });
          logs.bunRelease = await dbService.createLog({
            content: 'Need to look into that new bun release',
          });

          const reminders = {};
          reminders.callContractor = await dbService.createReminder({
            message: 'Call contractor about timeline',
            triggerAt: new Date(now.getTime() + 1 * dayMs).toISOString(),
            projectId: projects.house.id,
          });
          reminders.vitamins = await dbService.createReminder({
            message: 'Take vitamins',
            triggerAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0).toISOString(),
          });
          await dbService.markReminderSent({ id: reminders.vitamins.id });
          reminders.vitamins = await dbService.getReminder({ id: reminders.vitamins.id });

          const nextMonday = new Date(now);
          nextMonday.setDate(nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7));
          nextMonday.setHours(9, 0, 0, 0);
          reminders.weeklyReview = await dbService.createReminder({
            message: 'Weekly review',
            triggerAt: nextMonday.toISOString(),
            recurrence: { pattern: 'weekly', interval: 1 },
          });

          return { projects, tasks, logs, reminders };
        }
      }),
    ]
  });
}.module({
  name: 'eval.seed',
  imports: [base],
}).load();
