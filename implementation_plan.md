# Merge Plan: feature/operative-data-card with main

This document outlines the strategy for resolving the 11 conflicting files between the current `feature/operative-data-card` branch and `main`. 

## Background
The `main` branch has introduced significant routing (`RosterView`, `MatchView`) and state management updates (`useRosterStore`, `useMatchStore`), while simultaneously scaffolding placeholder UI components (`TestLab`, `OperativeCard`) and JSON data packs. 
Our `feature` branch, however, holds the most up-to-date and fully implemented Data Card UI (`OperativeCard` + `InfoOverlay` + Universal Rules + Bilingual JSON packs).

## Proposed Resolution Strategy

### 1. UI Components (`OperativeCard` & `TestLab`)
- **`src/ui/components/OperativeCard/OperativeCard.tsx` & `.css`** (Add/Add Conflict): **Keep Feature Branch (HEAD)**. The feature branch contains the complete implementation with `InfoOverlay` and styling. We will override any scaffolding from `main`.
- **`src/ui/test-lab/TestLab.tsx` & `.css`** (Add/Add Conflict): **Merge**. We will keep the `TestLab` layout and functionality from the feature branch, but update its props signature (`packs={TESTLAB_PACKS}`) to match the new `App.tsx` architecture introduced in `main`.

### 2. Application Architecture (`App.tsx` & `viewStore.ts`)
- **`src/App.tsx`** (Content Conflict): **Merge**. We will adopt `main`'s new routing (`RosterView`, `MatchView`) and state stores. We will also carefully re-inject the Language Switcher (中文/EN) from the feature branch into the header, as it's required for the bilingual data cards to function.
- **`src/state/viewStore.ts`** (Content Conflict): **Keep main**. The `main` branch has the latest view enums for routing.

### 3. Data Packs & Types (`*.json` & `types.ts`)
- **`src/data/packs/*.json`** (Content & Add/Add Conflict): **Keep Feature Branch (HEAD)**. The feature branch contains the bilingual ability names, the corrected syntax, and the latest `legionaries` and `plague_marines` data.
- **`src/rules/types.ts` & `faction-pack.schema.json`** (Content Conflict): **Merge**. We will combine any schema additions from `main` (if they added new rule definitions) with our feature branch's structure.

## Verification Plan
1. Run `git merge origin/main --no-commit` again.
2. Automatically resolve conflicts using script / replace commands following the above strategy.
3. Ensure the project builds successfully (`npm run build` or Vite check).
4. Present the final resolved UI to the user for validation.
