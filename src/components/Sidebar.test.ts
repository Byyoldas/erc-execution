import { describe, it, expect } from 'vitest';
import { buildModules } from './Sidebar';

const screens = (model: Parameters<typeof buildModules>[0]) =>
  buildModules(model).map((m) => m.screen);

describe('buildModules', () => {
  it('ERC: the sidebar has no consortium-planning entry at all', () => {
    expect(screens('Erc')).not.toContain('consortium-budget');
    expect(screens('Erc')).not.toContain('lump-sum-plan');
  });

  it('actual cost: Consortium Budget directly follows Partners', () => {
    const list = screens('HorizonActualCost');
    expect(list[list.indexOf('partners') + 1]).toBe('consortium-budget');
    expect(list).not.toContain('lump-sum-plan');
  });

  it('lump sum: Lump Sum Plan directly follows Partners', () => {
    const list = screens('HorizonLumpSum');
    expect(list[list.indexOf('partners') + 1]).toBe('lump-sum-plan');
    expect(list).not.toContain('consortium-budget');
  });

  it('every model keeps every existing screen, in the same order', () => {
    const erc = screens('Erc');
    for (const model of ['HorizonActualCost', 'HorizonLumpSum'] as const) {
      const without = screens(model).filter(
        (s) => s !== 'consortium-budget' && s !== 'lump-sum-plan',
      );
      expect(without).toEqual(erc);
    }
  });

  it('puts the planning screen before Personnel (dependency order)', () => {
    const list = screens('HorizonActualCost');
    expect(list.indexOf('consortium-budget')).toBeLessThan(list.indexOf('personnel'));
  });
});
