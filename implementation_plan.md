# Implementation Plan - Betting System Overhaul

## Goal
Refactor the Discord bot to use a persistent queue system for creating bets. Multiple queues (1x1, 2x2, etc.) will exist permanently. When a queue fills, a private bet channel is created automatically.

## Database Schema Changes
We need a new table `queues` and updates to `bets` to support flexible player lists (for >1v1).

### New Table: `queues`
- `id` (UUID, PK)
- `guild_id` (TEXT)
- `channel_id` (TEXT)
- `message_id` (TEXT)
- `game_mode` (TEXT) - e.g., '1x1', '2x2', '3x3', '4x4'
- `bet_value` (NUMERIC)
- `required_players` (INT)
- `current_players` (JSONB) - List of player IDs in queue.
- `status` (TEXT) - 'active', 'paused'

### Updates to `bets`
- Add `players_data` (JSONB) to store full list of participants and teams.
- Add `queue_id` (UUID) to reference the source queue.
- Maintain `jogador1_id` and `jogador2_id` for dashboard compatibility (using team captains).

## Commands & Interactions

### 1. Setup Queue Command (Admin)
`src/commands/setupQueue.ts`
- Command: `/setup_queue <mode> <value> <channel>`
- Creates a persistent embed message in the specified channel.
- Creates a row in `queues` table.

### 2. Queue Interactions
`src/interactions/queue.ts`
- **Join**:
    - Check if player is in any other queue or active bet.
    - Add to `current_players` in DB.
    - Update Message Embed (e.g., "1/2 Players").
    - If Full -> Trigger Match Start.
- **Leave**:
    - Remove from `current_players`.
    - Update Message Embed.

### 3. Match Start Logic
`src/utils/betManager.ts`
- Create private channel under "APOSTAS EM ANDAMENTO".
- Permissions: Players + Mediator + Admin.
- Insert into `bets`.
    - For 2x2: Split 4 players into Team A and Team B.
    - `jogador1_id` = Team A Captain. `jogador2_id` = Team B Captain.
- Send "Match Control Panel" to the private channel.
    - Buttons: [Finalizar Aposta] [Cancelar Aposta] (Admin/Mediator only).
- Reset Queue (empty `current_players` in DB and Message).

### 4. Match Control
`src/interactions/matchControl.ts`
- **Finalize**:
    - Opens modal/dropdown to select winner.
    - Updates `bets` status -> 'finalizada'.
    - Updates player stats.
    - Deletes/Archives channel.
- **Cancel**:
    - Updates `bets` status -> 'cancelada'.
    - Deletes channel.

## Security
- `isPlayerBusy()` check before joining queue.

## Workflow
1. Create Migration.
2. Implement `setupQueue` command.
3. Implement `queue` interactions (Join/Leave).
4. Implement `matchStart` logic.
5. Implement `matchControl` interactions.
