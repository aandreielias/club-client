/** The browser tab title: the open window's record, else the page, then the club name. */
export class DocumentTitle {
  page = $state('');
  window = $state('');

  constructor(private readonly suffix: () => string) {}

  get text(): string {
    return [this.window || this.page, this.suffix()].filter(Boolean).join(' · ');
  }
}
