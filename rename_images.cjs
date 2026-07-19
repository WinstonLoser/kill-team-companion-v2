const fs = require('fs');
const path = require('path');

const basePath = 'V:/Kill Team Assistant 2.0/public/assets/images';

const mappings = {
  'sm': {
    newFolder: 'angels_of_death',
    copies: [
      { src: 'sm_captain.jpg', dst: 'space_marine_captain.jpg' },
      { src: 'sm_sergeant.jpg', dst: 'assault_intercessor_sergeant.jpg' },
      { src: 'sm_sergeant.jpg', dst: 'intercessor_sergeant.jpg' },
      { src: 'sm_assault.jpg', dst: 'assault_intercessor_grenadier.jpg' },
      { src: 'sm_assault.jpg', dst: 'assault_intercessor_warrior.jpg' },
      { src: 'sm_heavy_gunner.jpg', dst: 'heavy_intercessor_gunner.jpg' },
      { src: 'sm_warrior_b.jpg', dst: 'intercessor_gunner.jpg' },
      { src: 'sm_warrior_a.jpg', dst: 'intercessor_warrior.jpg' },
      { src: 'sm_sniper.jpg', dst: 'eliminator_sniper.jpg' }
    ]
  },
  'pm': {
    newFolder: 'plague_marines',
    copies: [
      { src: 'pm_champion.jpg', dst: 'champion.jpg' },
      { src: 'pm_gunner.jpg', dst: 'bombardier.jpg' },
      { src: 'pm_fighter.jpg', dst: 'fighter.jpg' },
      { src: 'pm_heavy.jpg', dst: 'heavy_gunner.jpg' },
      { src: 'pm_icon.jpg', dst: 'icon_bearer.jpg' },
      { src: 'pm_caster.jpg', dst: 'malignant_plaguecaster.jpg' },
      { src: 'pm_warrior.jpg', dst: 'warrior.jpg' }
    ]
  },
  'leg': {
    newFolder: 'legionaries',
    copies: [
      { src: 'leg_champion.jpg', dst: 'aspiring_champion.jpg' },
      { src: 'leg_lord.jpg', dst: 'chosen.jpg' },
      { src: 'leg_anointed.jpg', dst: 'anointed.jpg' },
      { src: 'leg_apostate.jpg', dst: 'balefire_acolyte.jpg' },
      { src: 'leg_berserker.jpg', dst: 'butcher.jpg' },
      { src: 'leg_gunner.jpg', dst: 'gunner.jpg' },
      { src: 'leg_heavy.jpg', dst: 'heavy_gunner.jpg' },
      { src: 'leg_icon.jpg', dst: 'icon_bearer.jpg' },
      { src: 'leg_shrivetalon.jpg', dst: 'shrivetalon.jpg' },
      { src: 'leg_trooper.jpg', dst: 'warrior.jpg' }
    ]
  }
};

for (const [oldFolder, config] of Object.entries(mappings)) {
  const oldDirPath = path.join(basePath, oldFolder);
  const newDirPath = path.join(basePath, config.newFolder);
  
  if (fs.existsSync(oldDirPath)) {
    fs.renameSync(oldDirPath, newDirPath);
  }

  if (fs.existsSync(newDirPath)) {
    const filesToDelete = new Set();
    
    // Copy to new names
    for (const { src, dst } of config.copies) {
      const srcPath = path.join(newDirPath, src);
      const dstPath = path.join(newDirPath, dst);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, dstPath);
        filesToDelete.add(srcPath);
      }
    }
    
    // Delete old names
    for (const srcPath of filesToDelete) {
      if (fs.existsSync(srcPath)) {
        fs.unlinkSync(srcPath);
      }
    }
  }
}

console.log('Renaming complete.');
