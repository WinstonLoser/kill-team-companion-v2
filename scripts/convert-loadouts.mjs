// 一次性迁移：把每个 pack 的 operative.weaponRefs → loadouts（按 kind 分远程/近战两槽，每 weaponId 单项 option）。
// 跑完可删。行为等价于原「1 远程 + 1 近战」选择，但选择规则进数据。
import fs from 'node:fs'

const PACKS = [
  'src/data/packs/angels_of_death.v1.json',
  'src/data/packs/legionaries.v1.json',
  'src/data/packs/plague_marines.v1.json',
]

for (const path of PACKS) {
  const raw = fs.readFileSync(path, 'utf8')
  const pack = JSON.parse(raw)
  const weaponKind = new Map((pack.weapons ?? []).map((w) => [w.weaponId, w.kind]))
  let converted = 0
  for (const op of pack.operatives ?? []) {
    if (!op.weaponRefs) continue
    // guard：所有 weaponId 必须能解析到 weapon
    const dangling = op.weaponRefs.filter((id) => !weaponKind.has(id))
    if (dangling.length) {
      console.error(`✗ ${path} :: ${op.operativeId} :: 解析不到武器: ${dangling.join(', ')}`)
      process.exit(1)
    }
    const ranged = op.weaponRefs.filter((id) => weaponKind.get(id) === 'RANGED')
    const melee = op.weaponRefs.filter((id) => weaponKind.get(id) === 'MELEE')
    const loadouts = []
    if (ranged.length) loadouts.push({ description: '远程武器', options: ranged.map((r) => [r]) })
    if (melee.length) loadouts.push({ description: '近战武器', options: melee.map((m) => [m]) })
    if (ranged.length === 0 && melee.length === 0) {
      console.warn(`! ${path} :: ${op.operativeId} :: weaponRefs 为空，loadouts=[]`)
    }
    op.loadouts = loadouts
    delete op.weaponRefs
    converted++
  }
  // 保持原格式：2 空格、无尾换行
  fs.writeFileSync(path, JSON.stringify(pack, null, 2), 'utf8')
  console.log(`✓ ${path} :: ${converted} operatives 转换`)
}
