# mucus_exit 激活层 effect resolver — 实现计划

## 现状

mucus_exit 已转 `GRANT_MARKER{POISON} CONDITIONAL dieFaceEquals(3) @ ON_ACTIVATION_START`。kind + condition 数据层就绪，但**激活层无消费**——turnStateMachine 的 ACTIVATE 事件不处理 effect 栈、不掷骰、不判定条件。

## 需要的架构层：activation effect resolver

### 核心问题

激活 ≠ 流水线。当前激活是 reducer 一个 `ACTIVATE` event（写 operatives[uid].ready=true）。没有 step 序列、没有骰源、没有 effect 求值。

mucus_exit 的语义更复杂——它是**被动触发**：当敌方特工在 mucus_exit 持有者 3" 内激活时，掷 D3：
- D3=3 → 给该激活特工挂 POISON
- 已有 POISON → 受 D3 伤

### 实现方案（3 层）

#### 层 1：激活期 effect 快照 + 掷骰（纯函数）

```typescript
// src/state/activationResolver.ts
interface ActivationEffectContext {
  activatorUid: string        // 谁在激活
  activatorPos: Point
  boardOperatives: { uid: string; pos: Point; side: Side; markers: string[] }[]
  enemyWargearHolders: { uid: string; pos: Point; effects: Effect[] }[]  // 持 mucus_exit 的敌方
  dice: DiceSource
}

export interface ActivationEffectResult {
  markersGranted: { targetUid: string; marker: string }[]
  damageDealt: { targetUid: string; amount: number }[]
  trace: { effectId: string; dieFace: number; triggered: boolean }[]
}

export function resolveActivationEffects(ctx: ActivationEffectContext): ActivationEffectResult
```

**流程**：
1. 遍历敌方 wargear holders（持 mucus_exit 的）
2. 对每个在 3" 内的 holder：
   - 找到其 `GRANT_MARKER CONDITIONAL dieFaceEquals(3) @ ON_ACTIVATION_START` effect
   - 掷 D3（dice.roll(1)[0].nat → 如 >3 取 1-3 映射，或用 1d6%3+1）
   - evalPredicate(condition, { dieFace: result })
   - 真 → GRANT_MARKER 应用（activator 得 POISON）
   - 若 activator 已有 POISON → EXTRA_DAMAGE D3（额外掷骰）
3. 返回 markersGranted + damageDealt + trace

#### 层 2：matchStore 接线

在 `matchStore.activate(uid, side)` 后调 `resolveActivationEffects`：
- 从 board 构建 ActivationEffectContext（找 3" 内持 mucus_exit 的敌方）
- 应用结果到 tokens（addMarker / applyDamage）
- trace 写日志

```typescript
// matchStore.activate 后追加
const actx = buildActivationCtx(uid, get())
const aResult = resolveActivationEffects(actx)
aResult.markersGranted.forEach(({targetUid, marker}) => get().addMarker(targetUid, marker))
aResult.damageDealt.forEach(({targetUid, amount}) => get().applyDamage(targetUid, amount))
```

#### 层 3：UI 反馈

激活时如果 mucus_exit 触发：
- pushMsg `「排毒口触发：D3=X → {POISON/伤}」`
- UnitPanel marker 更新（已有 POISON 显示）
- 日志记录

### 数据调整

mucus_exit 当前 effect 可能需要拆为 2 effect（一个 GRANT_MARKER，一个 EXTRA_DAMAGE），或在 resolver 内根据「已有 POISON」分支。建议拆：

```json
{
  "effectId": "wargear_mucus_exit_grant",
  "trigger": { "point": "ON_ACTIVATION_START", "condition": { "op": "all", "all": [{ "op": "dieFaceEquals", "args": [3] }, { "op": "targetHasMarker", "args": ["!POISON"] }] } },
  "modifier": { "kind": "GRANT_MARKER", "payload": { "marker": "POISON", "target": "DEFENDER" } }
},
{
  "effectId": "wargear_mucus_exit_damage",
  "trigger": { "point": "ON_ACTIVATION_START", "condition": { "op": "all", "all": [{ "op": "dieFaceEquals", "args": [3] }, { "op": "targetHasMarker", "args": ["POISON"] }] } },
  "modifier": { "kind": "EXTRA_DAMAGE_ON_HIT", "payload": { "amount": 3 } }
}
```

（注：`targetHasMarker(["!POISON"])` 的否定语义需 evalPredicate 扩展——或用 `not` 组合。当前谓词库无 `not`，需加 `notExists` 或 `targetHasNoMarker`。）

### 谓词库扩展

加 `targetHasNoMarker`（或 `not` 组合器）：
```typescript
case 'targetHasNoMarker':
  return ctx.targetMarkers !== undefined && args.every((m) => !ctx.targetMarkers!.includes(String(m)))
```
（PREDICATE_OPS 11→12）

### 估时

| 层 | 工作量 | 可独立交付 |
|---|---|---|
| 层 1 纯函数 + 单测 | 中（~80 行 + 4 测试） | ✅ 可单测，不依赖 UI |
| 层 2 matchStore 接线 | 小（~20 行） | 需层 1 |
| 层 3 UI 反馈 | 小（pushMsg + 日志） | 需层 2 |
| 数据拆分 + 谓词扩展 | 小（node 改 JSON + predicates.ts +1 op） | 需层 1 |

**总计 ~150 行 + 5 测试，1 commit 可交付。**

### 风险

- **激活层掷骰可复现性**：需 seed（如 hashSeed(uid, 'ACTIVATION', turningPoint)）——复现性留 FR-17
- **多 wargear holder 同时在范围内**：逐 holder 掷骰 + 合并结果
- **与战斗流水线的 effect 栈隔离**：激活 effect 栈来自 wargear holders（非 attacker/defender 栈），需单独构建

### 不阻塞

mucus_exit 不影响任何其他机制——它是孤立的 wargear 效果。即使不做，v1 对局功能完整（排毒口只是「休眠 wargear」）。
