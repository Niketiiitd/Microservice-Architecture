import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Stripe from 'stripe';

@Injectable()
export class SubscriptionService {
  private stripe: Stripe;

  constructor(
    @InjectModel('User') private userModel: Model<any>,
    @InjectModel('Subscription') private subscriptionModel: Model<any>
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-05-28.basil' });
  }

  async getUserSubscription(email: string) {
    const dbUser = await this.userModel.findOne({ email }).populate('subscription');
    if (!dbUser) return null;
    return dbUser.subscription ? dbUser.subscription.toObject() : null;
  }

  async refreshUserSubscription(email: string) {
    const dbUser = await this.userModel.findOne({ email });
    if (!dbUser) {
      return { error: 'User not found' };
    }

    // Check and update Stripe Customer ID if missing
    if (!dbUser.customerId) {
      const customers = await this.stripe.customers.list({
        email: dbUser.email,
        limit: 1,
      });

      if (customers.data.length > 0) {
        dbUser.customerId = customers.data[0].id;
        await dbUser.save();
      } else {
        dbUser.subscription = null;
        await dbUser.save();
        await this.subscriptionModel.deleteMany({ user: dbUser._id });
        return { error: 'Stripe Customer not found' };
      }
    }

    // Fetch subscriptions from Stripe
    const subscriptions = await this.stripe.subscriptions.list({
      customer: dbUser.customerId,
      status: 'all',
      limit: 1,
    });

    if (
      !subscriptions.data ||
      subscriptions.data.length === 0 ||
      subscriptions.data[0].status !== 'active'
    ) {
      dbUser.subscription = null;
      await dbUser.save();
      await this.subscriptionModel.deleteMany({ user: dbUser._id });
      return { error: 'No active subscriptions found for the user' };
    }

    const stripeSubscription = subscriptions.data[0] as any;
    let subscriptionType = stripeSubscription.items.data[0].price.product;

    if (subscriptionType === process.env.NEXT_PUBLIC_STRIPE_STARTER_PROD_ID) {
      subscriptionType = 'Standard';
    } else if (subscriptionType === process.env.NEXT_PUBLIC_STRIPE_PRO_PROD_ID) {
      subscriptionType = 'Pro';
    } else {
      subscriptionType = 'Elite';
    }

    let subscription = await this.subscriptionModel.findOne({
      stripeSubscriptionId: stripeSubscription.id,
    });

    if (!subscription) {
      subscription = new this.subscriptionModel({
        user: dbUser._id,
        stripeSubscriptionId: stripeSubscription.id,
        status: stripeSubscription.status,
        startDate: new Date(stripeSubscription.current_period_start * 1000),
        endDate: stripeSubscription.current_period_end
          ? new Date(stripeSubscription.current_period_end * 1000)
          : null,
        willRenew: stripeSubscription.cancel_at_period_end === false,
        subscriptionType: subscriptionType,
      });
    } else {
      subscription.status = stripeSubscription.status;
      subscription.startDate = new Date(stripeSubscription.current_period_start * 1000);
      subscription.endDate = stripeSubscription.current_period_end
        ? new Date(stripeSubscription.current_period_end * 1000)
        : null;
      subscription.willRenew = stripeSubscription.cancel_at_period_end === false;
      subscription.subscriptionType = subscriptionType;
    }

    await subscription.save();

    // Associate the subscription with the user if not already associated
    if (
      !dbUser.subscription ||
      dbUser.subscription.toString() !== subscription._id.toString()
    ) {
      dbUser.subscription = subscription._id;
      await dbUser.save();
    }

    return subscription.toObject();
  }

  async createOrGetStripeSession(email: string, priceId: string, returnUrlBase: string) {
    const dbUser = await this.userModel.findOne({ email });
    if (!dbUser) {
      return { error: 'User not found', status: 404 };
    }

    let stripeCustomerId = dbUser.customerId;
    if (!stripeCustomerId) {
      const customers = await this.stripe.customers.list({ email, limit: 1 });
      if (customers.data.length > 0) {
        stripeCustomerId = customers.data[0].id;
        dbUser.customerId = stripeCustomerId;
        await dbUser.save();
      } else {
        return { error: 'Stripe customer not found', status: 404 };
      }
    }

    // Check for active/trialing subscriptions
    const subscriptions = await this.stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'all',
      limit: 1,
    });

    const activeSubscription = subscriptions.data.find(
      (sub) => sub.status === 'active' || sub.status === 'trialing'
    );

    if (activeSubscription) {
      // Create a Billing Portal session
      const billingSession = await this.stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: `${returnUrlBase}/dashboard`,
      });
      if (billingSession) {
        return { url: billingSession.url, status: 200 };
      } else {
        return { error: 'Error creating billing session', status: 500 };
      }
    } else {
      // No active subscription, create a Checkout session
      try {
        const checkoutSession = await this.stripe.checkout.sessions.create({
          customer: stripeCustomerId,
          payment_method_types: [],
          line_items: [{ price: priceId, quantity: 1 }],
          mode: 'subscription',
          success_url: `${returnUrlBase}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${returnUrlBase}/pricing`,
        });
        return { url: checkoutSession.url, status: 200 };
      } catch (error) {
        return { error: 'Error creating checkout session', status: 500 };
      }
    }
  }
}
