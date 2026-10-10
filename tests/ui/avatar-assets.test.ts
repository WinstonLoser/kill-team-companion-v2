import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { ALL_PACKS } from '../../src/data/packs'
import { getAvatarUrl } from '../../src/utils/avatars'
import { publicAssetUrl } from '../../src/utils/publicAssetUrl'
import { statusKind, statusLabel } from '../../src/ui/components/StatusBadge/StatusBadge'

describe('unit visual assets', () => {
  it('has a usable local portrait for every operative', () => {
    for (const pack of ALL_PACKS) {
      for (const operative of pack.operatives) {
        const url = getAvatarUrl(pack.faction.id, operative.operativeId)
        expect(url, `${pack.faction.id}/${operative.operativeId}`).toBeTruthy()
        const assetPath = url!.match(/assets\/.+$/)?.[0]
        expect(assetPath, url).toBeTruthy()
        expect(existsSync(resolve('public', assetPath!)), url).toBe(true)
      }
    }
  })

  it('keeps public assets under the configured deployment subpath', () => {
    expect(publicAssetUrl('assets/images/warpcoven/wc_sorcerer.webp', '/kill-team-companion-v2/'))
      .toBe('/kill-team-companion-v2/assets/images/warpcoven/wc_sorcerer.webp')
    expect(publicAssetUrl('/assets/icons/factions/warpcoven.png', '/kill-team-companion-v2'))
      .toBe('/kill-team-companion-v2/assets/icons/factions/warpcoven.png')
    expect(publicAssetUrl('assets/icons/factions/warpcoven.png', '/'))
      .toBe('/assets/icons/factions/warpcoven.png')
  })

  it('recognises poison source and other common markers', () => {
    expect(statusKind('POISON:a')).toBe('poison')
    expect(statusLabel('POISON:a', 'zh')).toBe('中毒 · A')
    expect(statusKind('APL -1')).toBe('apl-down')
    expect(statusKind('UNLISTED')).toBe('other')
  })
})
