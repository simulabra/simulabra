import { __, base } from 'simulabra';
import framework from '../framework.js';

export default await async function (_, $, $framework) {
  $framework.EvalCase.new({
    title: 'Multi-turn task creation and update',
    async scenario(ctx) {
      const conversationId = 'eval-multiturn-' + Date.now();

      const turn1 = await ctx.interpretMessage({
        conversationId,
        text: 'add a task to review the codebase',
        source: 'eval',
      });
      if (!turn1.success) throw new Error(`turn 1 failed: ${turn1.error}`);
      ctx.assertToolCalled(turn1, 'create_task');

      const beforeSnap = await ctx.snapshot();
      const createdTask = beforeSnap.tasks.find(t =>
        t.title?.toLowerCase().includes('review') && t.title?.toLowerCase().includes('codebase')
      );
      if (!createdTask) throw new Error('Turn 1 did not create a task with "review" and "codebase"');

      const turn2 = await ctx.interpretMessage({
        conversationId,
        text: `update task ${createdTask.id}, change priority to 2`,
        source: 'eval',
      });
      if (!turn2.success) throw new Error(`turn 2 failed: ${turn2.error}`);
      ctx.assertAnyToolCalled(turn2, ['update_task', 'move_to_project']);
    }
  });
}.module({
  name: 'eval.scenarios.multiturn',
  imports: [base, framework],
}).load();
