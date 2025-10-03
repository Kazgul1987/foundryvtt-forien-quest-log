# Manual QA: Importing a Journal Quest Export

These steps validate that quests embedded in journal entry flags import correctly through the Quest Log interface.

## Prerequisites

* Foundry VTT world with Forien's Quest Log enabled.
* The following JSON saved to a file (for example `journal-quest.json`).

```json
{
  "name": "Quest Journal Entry",
  "flags": {
    "forien-quest-log": {
      "quest": {
        "name": "Rescue the Prince",
        "status": "active",
        "giver": "King Roland",
        "giverData": {
          "name": "King Roland",
          "img": "icons/svg/mystery-man.svg"
        },
        "description": "<p>Save the prince from the shadow keep.</p>",
        "gmnotes": "<p>The prince is guarded by a night hag.</p>",
        "playernotes": "<p>Gather allies before assaulting the keep.</p>",
        "image": "icons/svg/book.svg",
        "giverName": "King Roland",
        "splash": "icons/svg/mountain.svg",
        "splashPos": "top",
        "splashAsIcon": false,
        "location": "Royal Keep",
        "priority": 1,
        "type": "Story",
        "tasks": [
          { "name": "Enter the keep", "completed": false, "failed": false, "hidden": false },
          { "name": "Find the prince", "completed": false, "failed": false, "hidden": false }
        ],
        "rewards": [
          { "type": "item", "data": { "name": "Royal Favor" }, "hidden": false, "locked": false }
        ],
        "date": { "create": 1714449600000, "start": null, "end": null }
      }
    }
  }
}
```

## Steps

1. Launch the Foundry world as a GM.
2. Open the quest log and click **Import**.
3. Select the saved `journal-quest.json` file.
4. When the import completes, locate the new quest named **Rescue the Prince**.

## Expected Results

* The quest appears in the list with the *Active* status.
* Quest details (giver name, description, GM notes, player notes, location, type, and splash art) all match the JSON sample.
* Tasks and rewards display with the full text from the JSON payload.
* No errors appear in the console during import.
