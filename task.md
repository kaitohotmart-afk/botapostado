# Task List - Betting System Overhaul

- [x] Database Migration
    - [x] Create `queues` table
    - [x] Add `players_data` and `queue_id` to `bets` table
- [x] Commands
    - [x] Implement `setupQueue` command (`src/commands/setupQueue.ts`)
    - [x] Register new command
- [x] Interactions
    - [x] Implement Queue Join Logic
    - [x] Implement Queue Leave Logic
    - [x] Implement Match Control (Finalize/Cancel)
- [x] match Manager
    - [x] Implement `BetManager` class/utils
    - [x] `createMatch` function (Channel creation, permissions)
    - [x] `resetQueue` function
- [x] Cleanup
    - [x] Remove old specific betting commands if necessary (or keep as fallback?) -> Plan says "Refazer o funcionamento interno", implies replacement. We will prioritize the new system.
