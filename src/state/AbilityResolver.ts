import { type Stratagem } from '../rules/types'

export class AbilityResolver {
  private activePloys: Stratagem[] = [];
  private cp: number = 2; // Initial CP
  private logs: string[] = [];
  
  constructor() {
    this.logs.push('[AbilityResolver] Engine initialized.');
  }

  // --- CP & PLOYS ---
  public getCP(): number {
    return this.cp;
  }

  public setCP(val: number) {
    this.cp = Math.max(0, val);
  }

  public activatePloy(ploy: Stratagem): boolean {
    if (this.cp >= ploy.cp) {
      this.cp -= ploy.cp;
      this.activePloys.push(ploy);
      this.log(`[Ploy Activated] Spent ${ploy.cp} CP on ${ploy.name}. CP remaining: ${this.cp}`);
      return true;
    }
    this.log(`[Error] Not enough CP to activate ${ploy.name}.`);
    return false;
  }

  public getActivePloys(): Stratagem[] {
    return this.activePloys;
  }

  // --- ABILITIES (Unique Actions) ---
  public useAbility(agentName: string, abilityName: string, apCost: number) {
    this.log(`[Ability Used] ${agentName} used '${abilityName}' (cost: ${apCost} AP).`);
    // Example: apply environment marker or aura here
  }

  // --- HOOKS (Middleware entry points for combat) ---
  public onBeforeShoot(attackerUid: string, targetUid: string) {
    this.log(`[Hook: onBeforeShoot] Checking buffs for ${attackerUid} attacking ${targetUid}...`);
    // Example: If 'Absolute Precision' ploy is active, add reroll 1s buff to combat context
  }

  public onDamageDealt(targetUid: string, amount: number) {
    this.log(`[Hook: onDamageDealt] ${targetUid} took ${amount} damage.`);
    // Example: If target has 'Feel No Pain' aura, reduce damage
  }

  // --- LOGGING ---
  public getLogs(): string[] {
    return this.logs;
  }

  private log(msg: string) {
    console.log(msg);
    this.logs.push(msg);
  }
}

// Singleton for sandbox testing
export const sandboxAbilityResolver = new AbilityResolver();
