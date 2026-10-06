# Local Merge Summary

I have successfully resolved all merge conflicts and synchronized your local `feature/operative-data-card` branch with `main`. 

## Conflict Resolution Details

### Data Packages & Schema (JSONs & `types.ts`)
- **Action**: Adopted `main`'s unified type schema (including `subFactionSelector` and `BuildConstraints`).
- **Data Preservation**: Maintained your `feature` branch's bilingual translations and abilities mapping for `angels_of_death`, `legionaries`, and `plague_marines`.

### UI Architecture (`App.tsx` & `TestLab`)
- **Action**: Combined both approaches into a unified layout.
- **Routing & State**: Brought in the `RosterView`, `MatchView`, and state stores introduced in `main`.
- **Localization**: Successfully re-integrated your language switcher (English/中文) into the top navigation bar.
- **Test Lab Adaptation**: Adapted the interactive logic from your `feature` branch to consume the `packs` array passed down from `main`'s new App structure.

### Operative Data Card (`OperativeCard.tsx` & `InfoOverlay`)
- **Action**: Fully retained your feature branch implementation.
- **Result**: The layout remains centered on the iPad canvas, and the interactive `InfoOverlay` for universal weapon rules and abilities continues to work flawlessly.

## Verification
- **Build Status**: The project compiles successfully (`npm run build` passed with zero errors).
- **TypeScript**: Resolved all schema discrepancy type errors across the `.tsx` components and test suites.

> [!TIP]
> You can now test the interface in the browser. The UI Lab should display correctly, and you should also see the new "建队" (Roster) and "对局" (Match) routes available from the top navigation bar. 
