/** The current time, refreshed once a minute, for labels like "überfällig" that change while a view stays open. */
class MinuteClock {
  #now = $state(new Date());
  #started = false;

  get now(): Date {
    if (!this.#started) {
      this.#started = true;
      setInterval(() => (this.#now = new Date()), 60_000); // one timer for the whole app, never stopped
    }
    return this.#now;
  }
}

export const minuteClock = new MinuteClock();
