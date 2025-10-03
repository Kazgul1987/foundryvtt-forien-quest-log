import {
   QuestDB,
   Socket,
   Utils,
   ViewManager }     from '../../control/index.js';

import { QuestAPI }  from '../../control/public/index.js';

import { Quest }     from '../../model/index.js';

import { FQLDialog } from '../internal/index.js';

import { questStatus } from '../../model/constants.js';

/**
 * Provides all {@link JQuery} callbacks for the {@link QuestLog}.
 */
export class HandlerLog
{
   /**
    * @private
    */
   constructor()
   {
      throw new Error('This is a static class that should not be instantiated.');
   }

   /**
    * Handles the quest add button.
    *
    * @returns {Promise<void>}
    */
   static async questAdd()
   {
      if (ViewManager.verifyQuestCanAdd())
      {
         const quest = await QuestDB.createQuest();
         ViewManager.questAdded({ quest });
      }
   }

   /**
    * Opens a file chooser to import quest data from JSON files.
    *
    * @returns {Promise<void>}
    */
   static async questImport()
   {
      if (!game.user.isGM) { return; }

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.multiple = true;
      input.style.display = 'none';

      const removeIfUnused = () =>
      {
         if (document.body.contains(input)) { input.remove(); }
         document.body.removeEventListener('focus', removeIfUnused, true);
      };

      input.addEventListener('change', async (event) =>
      {
         document.body.removeEventListener('focus', removeIfUnused, true);
         await HandlerLog.#handleImportInput(event);
      }, { once: true });

      document.body.appendChild(input);
      document.body.addEventListener('focus', removeIfUnused, true);
      input.click();
   }

   /**
    * Handles deleting a quest. The trashcan icon.
    *
    * @param {JQuery.ClickEvent} event - JQuery.ClickEvent
    *
    * @returns {Promise<void>}
    */
   static async questDelete(event)
   {
      const questId = $(event.target).data('quest-id');
      const name = $(event.target).data('quest-name');

      const result = await FQLDialog.confirmDeleteQuest({ name, result: questId, questId, isQuestLog: true });
      if (result)
      {
         await QuestDB.deleteQuest({ questId: result });
      }
   }

   /**
    * Prepares the data transfer when a quest is dragged from the {@link QuestLog}.
    *
    * @param {JQuery.DragStartEvent} event - JQuery.DragStartEvent
    */
   static questDragStart(event)
   {
      const dataTransfer = {
         type: Quest.documentName,
         id: $(event.target).data('quest-id')
      };

      event.originalEvent.dataTransfer.setData('text/plain', JSON.stringify(dataTransfer));
   }

   /**
    * Handles the quest open click via {@link QuestAPI.open}.
    *
    * @param {JQuery.ClickEvent} event - JQuery.ClickEvent
    */
   static questOpen(event)
   {
      const questId = $(event.target)?.closest('.drag-quest')?.data('quest-id');
      QuestAPI.open({ questId });
   }

   /**
    * Handles changing the quest status via {@link Socket.setQuestStatus}.
    *
    * @param {JQuery.ClickEvent} event - JQuery.ClickEvent
    *
    * @returns {Promise<void>}
    */
   static async questStatusSet(event)
   {
      const target = $(event.target).data('target');
      const questId = $(event.target).data('quest-id');

      const quest = QuestDB.getQuest(questId);
      if (quest) { await Socket.setQuestStatus({ quest, target }); }
   }

   /**
    * Handles quest import data from the selected files.
    *
    * @param {Event} event - The change event from the file input.
    *
    * @returns {Promise<void>}
    */
   static async #handleImportInput(event)
   {
      const input = event.currentTarget;

      if (!(input instanceof HTMLInputElement)) { return; }

      const files = Array.from(input.files ?? []);
      input.value = '';
      input.remove();

      if (!files.length) { return; }

      let success = 0;
      let fail = 0;

      for (const file of files)
      {
         let parsed;

         try
         {
            const text = await file.text();
            parsed = JSON.parse(text);
         }
         catch (error)
         {
            console.error('ForienQuestLog | Failed to read quest import file.', error);
            fail++;
            continue;
         }

         const questPayloads = HandlerLog.#normalizeImportPayload(parsed);

         if (!questPayloads.length)
         {
            fail++;
            continue;
         }

         for (const questData of questPayloads)
         {
            const sanitized = HandlerLog.#sanitizeQuestData(questData);

            if (!sanitized)
            {
               fail++;
               continue;
            }

            try
            {
               await QuestDB.createQuest({ data: sanitized });
               success++;
            }
            catch (error)
            {
               console.error('ForienQuestLog | Failed to create quest from import.', error);
               fail++;
            }
         }
      }

      HandlerLog.#notifyImportOutcome({ success, fail });
   }

   /**
    * Normalizes the JSON payload into an array of quest data objects.
    *
    * @param {unknown} payload - Raw JSON data.
    *
    * @returns {object[]} A normalized array of quest data objects.
    */
   static #normalizeImportPayload(payload)
   {
      if (Array.isArray(payload)) { return payload; }

      if (payload && typeof payload === 'object')
      {
         if (Array.isArray(payload.quests)) { return payload.quests; }
         if (Array.isArray(payload.data)) { return payload.data; }
         const flagQuest = payload.flags?.['forien-quest-log']?.quest;
         if (flagQuest && typeof flagQuest === 'object') { return [flagQuest]; }
         return [payload];
      }

      return [];
   }

   /**
    * Sanitizes quest data to match the expected schema.
    *
    * @param {unknown} data - The raw quest data.
    *
    * @returns {object|null} Sanitized quest data or null when invalid.
    */
   static #sanitizeQuestData(data)
   {
      if (!data || typeof data !== 'object') { return null; }

      const questData = foundry.utils.duplicate(data);

      const name = typeof questData.name === 'string' ? questData.name.trim() : '';
      const status = typeof questData.status === 'string' && Object.values(questStatus).includes(questData.status) ?
       questData.status : questStatus.inactive;

      const sanitized = {
         name: name.length > 0 ? name : game.i18n.localize('ForienQuestLog.API.QuestDB.Labels.NewQuest'),
         status,
         giver: typeof questData.giver === 'string' && questData.giver.trim().length > 0 ? questData.giver.trim() : null,
         giverData: HandlerLog.#sanitizeGiverData(questData.giverData),
         description: typeof questData.description === 'string' ? questData.description : '',
         gmnotes: typeof questData.gmnotes === 'string' ? questData.gmnotes : '',
         playernotes: typeof questData.playernotes === 'string' ? questData.playernotes : '',
         image: typeof questData.image === 'string' ? questData.image : 'actor',
         giverName: typeof questData.giverName === 'string' && questData.giverName.trim().length > 0 ?
          questData.giverName.trim() : 'actor',
         splash: typeof questData.splash === 'string' ? questData.splash : '',
         splashPos: HandlerLog.#sanitizeSplashPos(questData.splashPos),
         splashAsIcon: typeof questData.splashAsIcon === 'boolean' ? questData.splashAsIcon : false,
         location: typeof questData.location === 'string' && questData.location.trim().length > 0 ?
          questData.location.trim() : null,
         priority: Number.isInteger(questData.priority) ? questData.priority : 0,
         type: typeof questData.type === 'string' && questData.type.trim().length > 0 ? questData.type.trim() : null,
         parent: null,
         subquests: [],
         tasks: HandlerLog.#sanitizeTasks(questData.tasks),
         rewards: HandlerLog.#sanitizeRewards(questData.rewards)
      };

      const date = HandlerLog.#sanitizeDate(questData.date);
      if (date) { sanitized.date = date; }

      return sanitized;
   }

   /**
    * Ensures splash position contains a valid value.
    *
    * @param {unknown} splashPos - Splash alignment.
    *
    * @returns {string} Sanitized splash alignment.
    */
   static #sanitizeSplashPos(splashPos)
   {
      const allowed = ['top', 'center', 'bottom'];
      return typeof splashPos === 'string' && allowed.includes(splashPos) ? splashPos : 'center';
   }

   /**
    * Sanitizes giver data.
    *
    * @param {unknown} giverData - Raw giver data.
    *
    * @returns {object|null} Sanitized giver data or null when invalid.
    */
   static #sanitizeGiverData(giverData)
   {
      if (!giverData || typeof giverData !== 'object') { return null; }

      const data = foundry.utils.duplicate(giverData);

      const name = typeof data.name === 'string' ? data.name : '';
      const img = typeof data.img === 'string' ? data.img : '';
      const uuid = typeof data.uuid === 'string' ? data.uuid : void 0;
      const hasTokenImg = typeof data.hasTokenImg === 'boolean' ? data.hasTokenImg : false;

      if (!uuid && !name && !img) { return null; }

      return {
         ...(uuid ? { uuid } : {}),
         ...(name ? { name } : {}),
         ...(img ? { img } : {}),
         hasTokenImg
      };
   }

   /**
    * Sanitizes task data.
    *
    * @param {unknown} tasks - Raw tasks array.
    *
    * @returns {object[]} Sanitized task data entries.
    */
   static #sanitizeTasks(tasks)
   {
      if (!Array.isArray(tasks)) { return []; }

      return tasks.reduce((acc, task) =>
      {
         if (!task || typeof task !== 'object') { return acc; }

         const name = typeof task.name === 'string' ? task.name : '';

         acc.push({
            name,
            completed: Boolean(task.completed),
            failed: Boolean(task.failed),
            hidden: Boolean(task.hidden),
            uuidv4: Utils.uuidv4()
         });

         return acc;
      }, []);
   }

   /**
    * Sanitizes reward data.
    *
    * @param {unknown} rewards - Raw rewards array.
    *
    * @returns {object[]} Sanitized reward data entries.
    */
   static #sanitizeRewards(rewards)
   {
      if (!Array.isArray(rewards)) { return []; }

      return rewards.reduce((acc, reward) =>
      {
         if (!reward || typeof reward !== 'object') { return acc; }

         const type = typeof reward.type === 'string' ? reward.type : null;
         const data = reward.data && typeof reward.data === 'object' ? foundry.utils.duplicate(reward.data) : {};

         acc.push({
            type,
            data,
            hidden: typeof reward.hidden === 'boolean' ? reward.hidden : false,
            locked: typeof reward.locked === 'boolean' ? reward.locked : true,
            uuidv4: Utils.uuidv4()
         });

         return acc;
      }, []);
   }

   /**
    * Sanitizes quest date metadata.
    *
    * @param {unknown} date - Raw date data.
    *
    * @returns {{create: number|null, start: number|null, end: number|null}|void} Sanitized quest date metadata.
    */
   static #sanitizeDate(date)
   {
      if (!date || typeof date !== 'object') { return void 0; }

      const create = typeof date.create === 'number' ? date.create : null;
      const start = typeof date.start === 'number' ? date.start : null;
      const end = typeof date.end === 'number' ? date.end : null;

      if (create === null && start === null && end === null) { return void 0; }

      return { create, start, end };
   }

   /**
    * Posts a notification summarizing the import result.
    *
    * @param {{success: number, fail: number}} result - Import summary.
    */
   static #notifyImportOutcome({ success, fail })
   {
      const total = success + fail;

      if (success > 0 && fail === 0)
      {
         ViewManager.notifications.info(game.i18n.format('ForienQuestLog.QuestLog.Notifications.ImportSuccess',
          { count: success }));
      }
      else if (success > 0 && fail > 0)
      {
         ViewManager.notifications.warn(game.i18n.format('ForienQuestLog.QuestLog.Notifications.ImportPartial',
          { success, fail }));
      }
      else if (total > 0)
      {
         ViewManager.notifications.error(game.i18n.localize('ForienQuestLog.QuestLog.Notifications.ImportFailure'));
      }
   }
}
