# Quest Categories Semicolon Separation

## Goal
Verify that quest categories separated by semicolons are treated as distinct categories.

## Preconditions
- Foundry VTT with the Forien Quest Log module installed and activated.
- At least one quest exists (or create a test quest during the steps).

## Steps
1. Open the **Settings > Configure Settings** dialog in Foundry VTT.
2. Switch to the **Module Settings** tab and locate **Forien Quest Log**.
3. Set the **Quest Categories** value to `Main Quest;Side Quest` and save the configuration.
4. Open the Forien Quest Log interface.

## Expected Result
- The category filter list contains two distinct categories: `Main Quest` and `Side Quest`.
- Any quest assigned to one of the categories appears under the correct category header.
