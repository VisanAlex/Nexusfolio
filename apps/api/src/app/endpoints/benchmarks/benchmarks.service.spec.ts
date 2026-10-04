import { BenchmarkService } from '@ghostfolio/api/services/benchmark/benchmark.service';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';
import { MarketDataService } from '@ghostfolio/api/services/market-data/market-data.service';
import { DateRange, UserWithSettings } from '@ghostfolio/common/types';

import { DataSource } from '@prisma/client';

import { PortfolioService } from '../../portfolio/portfolio.service';
import { SymbolService } from '../../symbol/symbol.service';
import { BenchmarksService } from './benchmarks.service';

describe('BenchmarksService', () => {
  it('includes the baseline date when it precedes the first portfolio chart date', async () => {
    const baselineDate = new Date('2023-09-25T00:00:00.000Z');
    const chartDate = new Date('2023-09-26T00:00:00.000Z');
    const marketDataService = {
      marketDataItems: jest.fn(({ where: { date } }) => {
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
      })
    } as unknown as MarketDataService;
    const benchmarksService = new BenchmarksService(
      {
        calculateChangeInPercentage: (
          baseValue: number,
          currentValue: number
        ) => {
          return currentValue / baseValue - 1;
        }
      } as BenchmarkService,
      {
        getExchangeRatesByCurrency: jest.fn().mockResolvedValue({
          USDUSD: {
            '2023-09-25': 1,
            '2023-09-26': 1
          }
        })
      } as unknown as ExchangeRateDataService,
      marketDataService,
      {
        getPerformance: jest.fn().mockResolvedValue({
          chart: [{ date: '2023-09-26' }]
        })
      } as unknown as PortfolioService,
      {
        get: jest.fn().mockResolvedValue({ currency: 'USD', marketPrice: 110 })
      } as unknown as SymbolService
    );

    await expect(
      benchmarksService.getMarketDataForUser({
        dataSource: DataSource.YAHOO,
        dateRange: 'max' as DateRange,
        endDate: chartDate,
        impersonationId: undefined,
        startDate: baselineDate,
        symbol: 'CSSPX.MI',
        user: {
          id: 'user-id',
          settings: { settings: { baseCurrency: 'USD' } }
        } as UserWithSettings
      })
    ).resolves.toEqual({
      marketData: [
        { date: '2023-09-25', value: 0 },
        { date: '2023-09-26', value: 10.000000000000009 }
      ]
    });
  });
});
