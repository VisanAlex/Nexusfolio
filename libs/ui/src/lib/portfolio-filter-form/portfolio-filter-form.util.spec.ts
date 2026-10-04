import {
  getFiltersFromPortfolioFilterFormValue,
  getPortfolioFilterFormValue
} from './portfolio-filter-form.util';

describe('portfolio filter form utilities', () => {
  it('converts an asset type selection into an asset subclass filter', () => {
    expect(
      getFiltersFromPortfolioFilterFormValue({
        account: null,
        assetClass: null,
        assetSubClass: 'STOCK',
        holding: null,
        tag: null
      })
    ).toEqual([
      {
        id: 'STOCK',
        type: 'ASSET_SUB_CLASS'
      }
    ]);
  });

  it('restores an asset subclass filter into the form value', () => {
    expect(
      getPortfolioFilterFormValue(
        [{ id: 'STOCK', type: 'ASSET_SUB_CLASS' }],
        []
      )
    ).toEqual({
      account: null,
      assetClass: null,
      assetSubClass: 'STOCK',
      holding: null,
      tag: null
    });
  });
});
