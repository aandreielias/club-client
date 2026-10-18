import { mainPane } from '../container';
import { currentPane, type Pane } from './Pane';

/** The pane the calling page is in (the main pane outside the split view). Call during initialisation. */
export function usePane(): Pane {
  return currentPane() ?? mainPane;
}
