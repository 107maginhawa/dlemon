/**
 * Stripe shim - billing not available in embedded mode.
 */

class StripeResource {
  constructor(_stripe: Stripe) {}
}

class Customers extends StripeResource {
  async create(_params: any) { throw new Error('Stripe not available in embedded mode'); }
  async retrieve(_id: string) { throw new Error('Stripe not available in embedded mode'); }
  async update(_id: string, _params: any) { throw new Error('Stripe not available in embedded mode'); }
  async del(_id: string) { throw new Error('Stripe not available in embedded mode'); }
  async list(_params?: any) { return { data: [], has_more: false }; }
}

class Subscriptions extends StripeResource {
  async create(_params: any) { throw new Error('Stripe not available in embedded mode'); }
  async retrieve(_id: string) { throw new Error('Stripe not available in embedded mode'); }
  async update(_id: string, _params: any) { throw new Error('Stripe not available in embedded mode'); }
  async cancel(_id: string) { throw new Error('Stripe not available in embedded mode'); }
  async list(_params?: any) { return { data: [], has_more: false }; }
}

class PaymentIntents extends StripeResource {
  async create(_params: any) { throw new Error('Stripe not available in embedded mode'); }
  async retrieve(_id: string) { throw new Error('Stripe not available in embedded mode'); }
  async confirm(_id: string, _params?: any) { throw new Error('Stripe not available in embedded mode'); }
  async cancel(_id: string) { throw new Error('Stripe not available in embedded mode'); }
}

class PaymentMethods extends StripeResource {
  async attach(_id: string, _params: any) { throw new Error('Stripe not available in embedded mode'); }
  async detach(_id: string) { throw new Error('Stripe not available in embedded mode'); }
  async retrieve(_id: string) { throw new Error('Stripe not available in embedded mode'); }
  async list(_params?: any) { return { data: [], has_more: false }; }
}

class Prices extends StripeResource {
  async create(_params: any) { throw new Error('Stripe not available in embedded mode'); }
  async retrieve(_id: string) { throw new Error('Stripe not available in embedded mode'); }
  async list(_params?: any) { return { data: [], has_more: false }; }
}

class Products extends StripeResource {
  async create(_params: any) { throw new Error('Stripe not available in embedded mode'); }
  async retrieve(_id: string) { throw new Error('Stripe not available in embedded mode'); }
  async list(_params?: any) { return { data: [], has_more: false }; }
}

class Invoices extends StripeResource {
  async create(_params: any) { throw new Error('Stripe not available in embedded mode'); }
  async retrieve(_id: string) { throw new Error('Stripe not available in embedded mode'); }
  async pay(_id: string) { throw new Error('Stripe not available in embedded mode'); }
  async list(_params?: any) { return { data: [], has_more: false }; }
}

class Webhooks {
  constructEvent(_payload: any, _sig: string, _secret: string) {
    throw new Error('Stripe not available in embedded mode');
  }
}

class Stripe {
  customers: Customers;
  subscriptions: Subscriptions;
  paymentIntents: PaymentIntents;
  paymentMethods: PaymentMethods;
  prices: Prices;
  products: Products;
  invoices: Invoices;
  webhooks: Webhooks;

  constructor(_apiKey: string, _config?: any) {
    this.customers = new Customers(this);
    this.subscriptions = new Subscriptions(this);
    this.paymentIntents = new PaymentIntents(this);
    this.paymentMethods = new PaymentMethods(this);
    this.prices = new Prices(this);
    this.products = new Products(this);
    this.invoices = new Invoices(this);
    this.webhooks = new Webhooks();
  }
}

export default Stripe;
export { Stripe };
