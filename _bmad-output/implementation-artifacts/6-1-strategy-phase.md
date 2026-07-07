# Story 6.1.strategy.phase: 战略阶段屏幕（先手 D6 + CP 发放 + 全员就绪 + 计谋轮流）

Status: ready-for-dev

## Story

As a 玩家,
I want 战略阶段屏幕（先手 D6 + CP 发放 + 全员就绪 + 计谋轮流）,
so that 对局回合结构与 KT Lite 规则一致。

## Acceptance Criteria

详见 _bmad-output/planning-artifacts/epics.md Epic 6 Story 6.1.strategy.phase。

## Dev Notes

- 引擎支持已就绪：turnStateMachine 有 STRATEGY phase、CP tracking、turnReducer
- matchStore 需扩展：strategyPhase 流程（先手 D6、CP 发放、计谋轮流使用）
- 规则源：docs/rules/merged_kt_lite_rules_zh.md 战略阶段/交战阶段章节
- AR-9：UI 只 dispatch intent，不在视图层算 CP/先手

## Dev Agent Record

### Agent Model Used
（dev-story 时填）

### Completion Notes List

### File List
