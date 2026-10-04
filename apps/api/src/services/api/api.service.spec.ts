import { AssetSubClass } from '@prisma/client';

import { ApiService } from './api.service';

describe('ApiService', () => {
  it('builds an asset subclass filter from user settings', () => {
    const filters = new ApiService().buildFiltersFromUserSettings({
      userSettings: {
        'filters.assetSubClasses': [AssetSubClass.STOCK]
      }
    });

    expect(filters).toEqual([
      {
        id: AssetSubClass.STOCK,
        type: 'ASSET_SUB_CLASS'
      }
    ]);
  });
});
