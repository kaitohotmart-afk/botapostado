# Walkthrough - New Queue System

## Overview
We have replaced the old betting system with a new **Persistent Queue System**. 
Admins create permanent queues (messages) in channels, and players join them. When full, a private channel is created for the match.

## Changes Made
- **Database**: 
    - Created `queues` table.
    - Added `players_data` and `queue_id` to `bets` table.
- **Commands**:
    - Added `/setup_queue` command.
- **Interactions**:
    - Implemented `join_queue` and `leave_queue`.
    - Implemented `match_finalize` and `match_cancel`.
- **Logic**:
    - Automatic match creation when queue fills.
    - Automatic queue reset (empty list) after match creation.

## How to Test

### 1. Create a Queue
Run the following command in a channel:
`/setup_queue mode:1x1 value:50 type:mobile`

- This will create an embed message with "Entrar na Fila" button.

### 2. Join Queue
- Click **"Entrar na Fila"**.
- The embed should update to show "1/2 Players".
- Have another account (or friend) click the button.

### 3. Match Process
- When the 2nd player joins, the queue resets to 0/2.
- A new channel `x1-50-match-xxxx` appears in the category **APOSTAS EM ANDAMENTO**.
- Inside the channel, you will see the **Control Panel** with buttons.

### 4. Admin Control
- Click **"Finalizar Aposta"** -> Select Winner.
- Or click **"Cancelar Aposta"**.
- The channel will be deleted after a few seconds.

## Database Verification
You can check the `queues` table in Supabase to see the active queues.
