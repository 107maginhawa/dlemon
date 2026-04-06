import { Page, Locator } from '@playwright/test';

export class ProviderListPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly filterInsurance: Locator;
  readonly filterSpecialization: Locator;
  readonly filterLanguage: Locator;
  readonly filterDateTime: Locator;
  readonly sortDropdown: Locator;
  readonly providerCards: Locator;
  readonly loadMoreButton: Locator;
  readonly noResultsMessage: Locator;
  readonly clearFiltersButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByPlaceholder('Search by name, specialty, or city...');
    this.filterInsurance = page.getByRole('checkbox', { name: /accepts insurance/i });
    this.filterSpecialization = page.getByRole('combobox', { name: /specialization/i });
    this.filterLanguage = page.getByRole('combobox', { name: /language/i });
    this.filterDateTime = page.getByRole('combobox', { name: /availability/i });
    this.sortDropdown = page.getByRole('combobox', { name: /sort by/i });
    this.providerCards = page.locator('[data-testid="provider-card"]');
    this.loadMoreButton = page.getByRole('button', { name: /load more/i });
    this.noResultsMessage = page.getByText(/no providers found/i);
    this.clearFiltersButton = page.getByRole('button', { name: /clear all/i });
  }

  async goto() {
    await this.page.goto('/professionals');
  }

  async searchProviders(query: string) {
    await this.searchInput.clear();
    await this.searchInput.fill(query);
    // Search is auto-triggered on input change (no search button)
    await this.page.waitForTimeout(500); // Brief delay for filtering to apply
  }

  async filterByInsurance(acceptsInsurance: boolean) {
    if (acceptsInsurance) {
      await this.filterInsurance.check();
    } else {
      await this.filterInsurance.uncheck();
    }
    await this.page.waitForLoadState('networkidle');
  }

  async filterBySpecialization(specialization: string) {
    await this.filterSpecialization.click();
    await this.page.getByRole('option', { name: specialization }).click();
    await this.page.waitForLoadState('networkidle');
  }

  async filterByLanguage(language: string) {
    await this.filterLanguage.click();
    await this.page.getByRole('option', { name: language }).click();
    await this.page.waitForLoadState('networkidle');
  }

  async filterByDateTime(option: string) {
    await this.filterDateTime.click();
    await this.page.getByRole('option', { name: option }).click();
    await this.page.waitForLoadState('networkidle');
  }

  async sortBy(sortOption: 'rating' | 'experience' | 'price') {
    await this.sortDropdown.click();
    const optionText = {
      rating: 'Highest Rating',
      experience: 'Most Experience',
      price: 'Lowest Price',
    }[sortOption];
    await this.page.getByRole('option', { name: optionText }).click();
    await this.page.waitForLoadState('networkidle');
  }

  async getProviderCount(): Promise<number> {
    return await this.providerCards.count();
  }

  async getProviderNames(): Promise<string[]> {
    const names: string[] = [];
    const count = await this.providerCards.count();
    for (let i = 0; i < count; i++) {
      const name = await this.providerCards.nth(i).locator('[data-testid="provider-name"]').textContent();
      if (name) names.push(name);
    }
    return names;
  }

  async clickProviderCard(index: number = 0) {
    await this.providerCards.nth(index).click();
    await this.page.waitForLoadState('networkidle');
  }

  async loadMore() {
    await this.loadMoreButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async isNoResultsVisible(): Promise<boolean> {
    return await this.noResultsMessage.isVisible();
  }

  async clearAllFilters() {
    // Use the "Clear All" button
    await this.clearFiltersButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Capture API request parameters for provider search
   * Returns the query parameters sent to the /providers endpoint
   */
  async captureProviderSearchParams(): Promise<URLSearchParams | null> {
    return new Promise((resolve) => {
      const responseHandler = (response: any) => {
        const url = response.url();
        if (url.includes('/providers')) {
          const urlObj = new URL(url);
          resolve(urlObj.searchParams);
          this.page.off('response', responseHandler);
        }
      };
      this.page.on('response', responseHandler);

      // Timeout after 5 seconds
      setTimeout(() => {
        this.page.off('response', responseHandler);
        resolve(null);
      }, 5000);
    });
  }

  async waitForProvidersToLoad() {
    await this.page.waitForSelector('[data-testid="provider-card"]', {
      state: 'visible',
      timeout: 10000
    });
  }

  async getProviderRating(index: number = 0): Promise<string | null> {
    return await this.providerCards.nth(index).locator('[data-testid="provider-rating"]').textContent();
  }

  async getProviderSpecializations(index: number = 0): Promise<string[]> {
    const specializations: string[] = [];
    const specs = await this.providerCards.nth(index).locator('[data-testid="provider-specialization"]').all();
    for (const spec of specs) {
      const text = await spec.textContent();
      if (text) specializations.push(text);
    }
    return specializations;
  }

  async isLoadMoreVisible(): Promise<boolean> {
    return await this.loadMoreButton.isVisible();
  }
}