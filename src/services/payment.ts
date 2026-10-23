export interface PaymentProvider{checkout():Promise<{status:'demo_failed';redirect:'/404'}>;}
export const demoPaymentProvider:PaymentProvider={async checkout(){return {status:'demo_failed',redirect:'/404'};}};
