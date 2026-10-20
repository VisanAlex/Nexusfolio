import { PortfolioService } from '@ghostfolio/api/app/portfolio/portfolio.service';
import { SymbolService } from '@ghostfolio/api/app/symbol/symbol.service';
import { BenchmarkService } from '@ghostfolio/api/services/benchmark/benchmark.service';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';
import { MarketDataService } from '@ghostfolio/api/services/market-data/market-data.service';
import { parseDate } from '@ghostfolio/common/helper';

import { DataSource } from '@prisma/client';

import { BenchmarksService } from './benchmarks.service';

describe('BenchmarksService', () => {
  let benchmarksService: BenchmarksService;
  let get: jest.Mock;
  let getExchangeRatesByCurrency: jest.Mock;
  let getPerformance: jest.Mock;
  let getRange: jest.Mock;
  let marketDataItems: jest.Mock;

  beforeEach(() => {
    get = jest.fn().mockResolvedValue({ currency: 'USD', marketPrice: 200 });
    getExchangeRatesByCurrency = jest.fn().mockResolvedValue({});
    getPerformance = jest.fn().mockResolvedValue({
      chart: [
        { date: '2009-01-01' },
        { date: '2009-06-01' },
        { date: '2010-07-18' },
        { date: '2010-07-19' }
      ]
    });
    getRange = jest.fn().mockResolvedValue([]);
    marketDataItems = jest.fn();

    benchmarksService = new BenchmarksService(
      new BenchmarkService(null, null, null, null, null, null),
      { getExchangeRatesByCurrency } as unknown as ExchangeRateDataService,
      { getRange, marketDataItems } as unknown as MarketDataService,
      { getPerformance } as unknown as PortfolioService,
      { get } as unknown as SymbolService
    );
  });

  describe('getMarketDataForUser', () => {
    const getMarketDataForUser = ({
      endDate = parseDate('2010-07-19'),
      startDate = parseDate('2009-01-02')
    }: { endDate?: Date; startDate?: Date } = {}) => {
      return benchmarksService.getMarketDataForUser({
        endDate,
        dataSource: DataSource.COINGECKO,
        dateRange: 'max',
        startDate,
        symbol: 'bitcoin',
        userId: 'user-id',
        userSettings: { baseCurrency: 'CHF' }
      });
    };

    it('includes the baseline date when it precedes the first portfolio chart date', async () => {
      const baselineDate = new Date('2023-09-25T00:00:00.000Z');
      const chartDate = new Date('2023-09-26T00:00:00.000Z');
      getPerformance.mockResolvedValue({ chart: [{ date: '2023-09-26' }] });
      marketDataItems.mockImplementation(({ where: { date } }) => {
        const hasBaselineDate = date.in.some((item: Date) => {
          return item.getTime() === baselineDate.getTime();
        });

        return Promise.resolve(
          hasBaselineDate
            ? [
                { date: baselineDate, marketPrice: 100 },
                { date: chartDate, marketPrice: 110 }
              ]
            : [{ date: chartDate, marketPrice: 110 }]
        );
      });

      await expect(
        getMarketDataForUser({ endDate: chartDate, startDate: baselineDate })
      ).resolves.toEqual({
        marketData: [
          { date: '2023-09-25', value: 0 },
          { date: '2023-09-26', value: 10.000000000000009 }
        ]
      });
    });

    it('calculates the change since the baseline date', async () => {
      marketDataItems.mockResolvedValue([
        { date: new Date('2009-01-01'), marketPrice: 50 },
        { date: new Date('2009-06-01'), marketPrice: 25 },
        { date: new Date('2010-07-18'), marketPrice: 75 },
        { date: new Date('2010-07-19'), marketPrice: 100 }
      ]);

      await expect(getMarketDataForUser()).resolves.toEqual({
        marketData: [
          { date: '2009-01-01', value: 0 },
          { date: '2009-06-01', value: -50 },
          { date: '2010-07-18', value: 50 },
          { date: '2010-07-19', value: 100 }
        ]
      });

      expect(getRange).not.toHaveBeenCalled();
    });

    it('returns no values before the market data of the benchmark starts', async () => {
      marketDataItems.mockResolvedValue([
        { date: new Date('2010-07-18'), marketPrice: 50 },
        { date: new Date('2010-07-19'), marketPrice: 100 }
      ]);

      await expect(getMarketDataForUser()).resolves.toEqual({
        marketData: [
          { date: '2010-07-18', value: 0 },
          { date: '2010-07-19', value: 100 }
        ]
      });

      expect(getRange).toHaveBeenCalledWith({
        assetProfileIdentifiers: [
          { dataSource: DataSource.COINGECKO, symbol: 'bitcoin' }
        ],
        dateQuery: { lt: new Date('2009-01-01') },
        take: 1
      });

      expect(marketDataItems).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { date: 'asc' } })
      );
    });

    it('uses the exchange rate at the start of the market data', async () => {
      getExchangeRatesByCurrency.mockResolvedValue({
        USDCHF: {
          '2009-01-01': 2,
          '2009-06-01': 2,
          '2010-07-18': 1,
          '2010-07-19': 1.5
        }
      });

      marketDataItems.mockResolvedValue([
        { date: new Date('2010-07-18'), marketPrice: 50 },
        { date: new Date('2010-07-19'), marketPrice: 100 }
      ]);

      await expect(getMarketDataForUser()).resolves.toEqual({
        marketData: [
          { date: '2010-07-18', value: 0 },
          { date: '2010-07-19', value: 200 }
        ]
      });
    });

    it('calculates the value at the end date since the start of the market data', async () => {
      getExchangeRatesByCurrency.mockResolvedValue({
        USDCHF: {
          '2009-01-01': 2,
          '2010-07-18': 1,
          '2010-07-19': 1,
          '2010-07-20': 1.5
        }
      });

      marketDataItems.mockResolvedValue([
        { date: new Date('2010-07-18'), marketPrice: 50 },
        { date: new Date('2010-07-19'), marketPrice: 100 }
      ]);

      await expect(
        getMarketDataForUser({ endDate: parseDate('2010-07-20') })
      ).resolves.toEqual({
        marketData: [
          { date: '2010-07-18', value: 0 },
          { date: '2010-07-19', value: 100 },
          { date: '2010-07-20', value: 500 }
        ]
      });
    });

    it('returns no market data if the market data at the baseline date is missing', async () => {
      getRange.mockResolvedValue([
        { date: new Date('2008-12-31'), marketPrice: 40 }
      ]);

      marketDataItems.mockResolvedValue([
        { date: new Date('2010-07-18'), marketPrice: 50 },
        { date: new Date('2010-07-19'), marketPrice: 100 }
      ]);

      await expect(getMarketDataForUser()).resolves.toEqual({
        marketData: []
      });

      expect(getExchangeRatesByCurrency).not.toHaveBeenCalled();
    });

    it('returns no market data if the benchmark has none', async () => {
      marketDataItems.mockResolvedValue([]);

      await expect(getMarketDataForUser()).resolves.toEqual({
        marketData: []
      });
    });
  });
});
