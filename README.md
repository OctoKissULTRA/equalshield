# EqualShield - Enterprise ADA Compliance Platform

Professional accessibility compliance platform providing comprehensive WCAG 2.1 AA scanning, VPAT documentation generation, and expert remediation support for Fortune 500 companies, government agencies, and educational institutions.

## Key Features

### 🔍 **Professional Accessibility Scanning**
- Real WCAG 2.1 Level AA compliance testing using Puppeteer + axe-core
- Automated scanning against Section 508, ADA Title III, and EN 301 549 standards
- Comprehensive POUR principles analysis (Perceivable, Operable, Understandable, Robust)
- Detailed violation reporting with WCAG criterion references

### 📋 **VPAT Documentation Generation**
- Automated VPAT® 2.5 documentation for federal procurement
- Section 508 conformance reports
- EN 301 549 international compliance documentation
- Legal compliance documentation for audit trails

### 🏢 **Enterprise-Grade Platform**
- Professional landing page with regulatory framework positioning
- Three-tier pricing: Professional ($997/mo), Enterprise ($2,497/mo), Global (Custom)
- Enterprise dashboard with compliance monitoring
- Expert remediation guidance and implementation support

## Technology Stack

- **Framework**: [Next.js 15](https://nextjs.org/) with TypeScript
- **Database**: [PostgreSQL](https://www.postgresql.org/) with [Drizzle ORM](https://orm.drizzle.team/)
- **Scanning Engine**: [Puppeteer](https://pptr.dev/) + [@axe-core/puppeteer](https://github.com/dequelabs/axe-core-npm)
- **Payments**: [Stripe](https://stripe.com/) with enterprise subscription management
- **UI Framework**: [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Authentication**: JWT-based with secure session management

## Getting Started

```bash
git clone https://github.com/nextjs/saas-starter
cd saas-starter
pnpm install
```

## Running Locally

[Install](https://docs.stripe.com/stripe-cli) and log in to your Stripe account:

```bash
stripe login
```

Use the included setup script to create your `.env` file:

```bash
pnpm db:setup
```

Run the database migrations and seed the database with a default user and team:

```bash
pnpm db:migrate
pnpm db:seed
```

This will create the following user and team:

- User: `test@test.com`
- Password: `admin123`

You can also create new users through the `/sign-up` route.

Finally, run the Next.js development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the app in action.

You can listen for Stripe webhooks locally through their CLI to handle subscription change events:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Testing Payments

To test Stripe payments, use the following test card details:

- Card Number: `4242 4242 4242 4242`
- Expiration: Any future date
- CVC: Any 3-digit number

## Going to Production

When you're ready to deploy your SaaS application to production, follow these steps:

### Set up a production Stripe webhook

1. Go to the Stripe Dashboard and create a new webhook for your production environment.
2. Set the endpoint URL to your production API route (e.g., `https://yourdomain.com/api/stripe/webhook`).
3. Select the events you want to listen for (e.g., `checkout.session.completed`, `customer.subscription.updated`).

### Deploy to Vercel

1. Push your code to a GitHub repository.
2. Connect your repository to [Vercel](https://vercel.com/) and deploy it.
3. Follow the Vercel deployment process, which will guide you through setting up your project.

### Add environment variables

In your Vercel project settings (or during deployment), add all the necessary environment variables. Make sure to update the values for the production environment, including:

1. `BASE_URL`: Set this to your production domain.
2. `STRIPE_SECRET_KEY`: Use your Stripe secret key for the production environment.
3. `STRIPE_WEBHOOK_SECRET`: Use the webhook secret from the production webhook you created in step 1.
4. `POSTGRES_URL`: Set this to your production database URL.
5. `AUTH_SECRET`: Set this to a random string. `openssl rand -base64 32` will generate one.

## Other Templates

While this template is intentionally minimal and to be used as a learning resource, there are other paid versions in the community which are more full-featured:

- https://achromatic.dev
- https://shipfa.st
- https://makerkit.dev
- https://zerotoshipped.com
- https://turbostarter.dev
