# Solana Prediction Market MVP

A Polymarket-style decentralized prediction market built with Anchor on Solana.

## Overview
This program allows users to bet USDC on binary outcomes (YES or NO) for a specific question. It uses a parimutuel pool model where winners split the total pool of USDC proportionally based on their initial stake.

## Payout Formula
The program uses `u128` precision for calculations to ensure accuracy:

```text
payout = (user_winning_stake * total_pool) / total_winning_pool
```

Where:
- `user_winning_stake`: The amount of USDC the user bet on the winning side.
- `total_pool`: The sum of all YES and NO bets in the market.
- `total_winning_pool`: The sum of all bets on the winning side.

## Instructions

1.  **create_market**: An admin (creator) initializes a market with a question string and a UNIX timestamp `end_time`. It creates a PDA vault for secure USDC custody.
2.  **bet_yes / bet_no**: Users transfer USDC into the market's vault. A `Position` account is created for each user per market to track their stake.
3.  **resolve_market**: After `end_time` has passed, the creator resolves the market to either `true` (YES) or `false` (NO).
4.  **claim_winnings**: Users who bet on the correct outcome can withdraw their portion of the total pool. The `claimed` flag ensures each position can only be paid out once.

## Safety & Security
- **Strict Timing**: Betting is strictly disabled after `end_time`.
- **PDA Custody**: The USDC vault is a Program Derived Address, meaning only the smart contract can authorize transfers out of it.
- **Double-Claim Prevention**: The `Position` account tracks the `claimed` status for every user.
- **Proportional Payout**: Calculated on-chain at the moment of claim.

## Local Setup & Deployment

1.  **Install Anchor & Solana CLI**:
    Ensure you have the Solana toolsuite and Anchor installed.
2.  **Install dependencies**:
    ```bash
    cd prediction-market
    npm install
    ```
3.  **Build the program**:
    ```bash
    anchor build
    ```
4.  **Deploy to Localnet**:
    Start your local validator:
    ```bash
    solana-test-validator
    ```
    Deploy:
    ```bash
    anchor deploy
    ```
5.  **Run Tests**:
    ```bash
    anchor test
    ```
