import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { ALL_PACKS } from '../../src/data/packs'
import { getAvatarUrl } from '../../src/utils/avatars'
import { statusKind, statusLabel } from '../../src/ui/components/StatusBadge/StatusBadge'

describe('unit visual assets', () => {
  it('has a usable local portrait for every operative', () => {
    for (const pack of ALL_PACKS) {
      for (const operative of pack.operatives) {
        const url = getAvatarUrl(pack.faction.id, operative.operativeId)
        expect(url, `${pack.faction.id}/${operative.operativeId}`).toBeTruthy()
        expect(existsSync(resolve('public', url!.replace(/^\//, ''))), url).toBe(true)
      }
    }
  })

  it('recognises poison source and other common markers', () => {
    expect(statusKind('POISON:a')).toBe('poison')
    expect(statusLabel('POISON:a', 'zh')).toBe('中毒 · A')
    expect(statusKind('APL -1')).toBe('apl-down')
    expect(statusKind('UNLISTED')).toBe('other')
  })
})
