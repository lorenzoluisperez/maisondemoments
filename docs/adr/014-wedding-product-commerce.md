# 014 Wedding product commerce

Status: accepted for the commercial wedding release, 2026-09-28.

The three complete wedding showcases become Garden Romance, Coastal Romance, and Heritage Romance. Each has Essential, Signature, and Couture tiers. Essential and Signature have independently configured PHP prices and full upfront payment; Couture starts with a scoped, immutable proposal. All customer terms and prices are snapshotted at purchase. The design remains staff-operated, and the customer edits facts rather than arbitrary presentation code.

Use one application and deployment with public storefront, customer portal, admin, studio, and private guest routes. Enforce staff MFA and server-side roles. Use Supabase email codes for customers and PayMongo hosted checkout in PHP. A signed webhook or authenticated provider lookup confirms payment; a browser redirect does not. Keep payment-provider code behind a small adapter for a future Stripe integration when merchant eligibility changes. The legacy manual-payment foundation remains for historical orders.

For the initial controlled release, staff issue full refunds in PayMongo and enter the provider refund ID in admin. The application reads PayMongo's final state and records a reversal only for a succeeded full refund matching the original payment, currency, amount, and merchant mode. It suspends any live invitation. Partial refunds and automatic discovery require additional accounting work before those cases are supported in the application.

The same versioned selected-design renderer must serve demo fixtures, studio previews, customer reviews, and private invitations. Product content stays separate from bounded presentation settings and immutable snapshots. Preserve old renderer snapshots and historical financial, approval, and RSVP records through additive migrations.

Consequences: one deployment is easier to operate now, while design-specific art remains possible. Sales cannot open until prices, terms, tax and invoice handling, merchant activation, email delivery, media backup, music rights, and test-mode transaction recovery are verified. More event categories require their own finished product designs and acceptance work.
