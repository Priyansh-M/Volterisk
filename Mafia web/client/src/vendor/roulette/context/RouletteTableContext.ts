import { createContext } from 'react';
import type { MouseEvent } from 'react';

import type { Bets, Chips } from '../types';

export interface IRouletteTableContextProps {
  bets: Bets;
  onBetCatcherHover: (event: MouseEvent<HTMLDivElement>) => void;
  chips: Chips;
}

export const RouletteTableContext = createContext({
  bets: {} as Bets,
  onBetCatcherHover: () => null,
  chips: {},
} as IRouletteTableContextProps);
