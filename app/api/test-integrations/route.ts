import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { teams } from '@/lib/db/schema';
import Stripe from 'stripe';
import OpenAI from 'openai';

export async function GET() {
  const results: {
    database: { status: string; data: any; error: string | null };
    stripe: { status: string; data: any; error: string | null };
    openai: { status: string; data: any; error: string | null };
  } = {
    database: { status: 'not_tested', data: null, error: null },
    stripe: { status: 'not_tested', data: null, error: null },
    openai: { status: 'not_tested', data: null, error: null }
  };

  // Test Database (PostgreSQL + Drizzle)
  try {
    const postgresUrl = process.env.POSTGRES_URL;
    
    if (!postgresUrl) {
      results.database = {
        status: 'error',
        data: null,
        error: 'Missing POSTGRES_URL environment variable'
      };
    } else {
      // Test database connection by querying teams table
      const teamsData = await db.select().from(teams).limit(1);
      
      results.database = {
        status: 'success',
        data: {
          connection: 'PostgreSQL + Drizzle ORM',
          teams_count: teamsData.length,
          sample_data: teamsData.length > 0 ? teamsData[0] : 'No teams yet'
        },
        error: null
      };
    }
  } catch (error) {
    results.database = {
      status: 'error',
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }

  // Test Stripe
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    
    if (!stripeSecretKey) {
      results.stripe = {
        status: 'error',
        data: null,
        error: 'Missing STRIPE_SECRET_KEY environment variable'
      };
    } else {
      const stripe = new Stripe(stripeSecretKey);
      
      const prices = await stripe.prices.list({ limit: 3 });
      
      results.stripe = {
        status: 'success',
        data: {
          price_count: prices.data.length,
          prices: prices.data.map(p => ({
            id: p.id,
            amount: p.unit_amount,
            currency: p.currency,
            interval: p.recurring?.interval
          }))
        },
        error: null
      };
    }
  } catch (error) {
    results.stripe = {
      status: 'error',
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }

  // Test OpenAI (GPT)
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      results.openai = {
        status: 'error',
        data: null,
        error: 'Missing OPENAI_API_KEY environment variable'
      };
    } else {
      const openai = new OpenAI({
        apiKey: openaiApiKey
      });
      
      // Test with a simple completion
      const completion = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "user",
            content: "Just respond with 'GPT-5 API test successful' - this is a connection test"
          }
        ],
        max_completion_tokens: 20
      });
      
      results.openai = {
        status: 'success',
        data: {
          model_used: completion.model,
          response: completion.choices[0]?.message?.content,
          usage: completion.usage
        },
        error: null
      };
    }
  } catch (error) {
    results.openai = {
      status: 'error',
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }

  // Log results to console for debugging
  console.log('🧪 INTEGRATION TEST RESULTS:');
  console.log('============================');
  console.log('Database:', results.database);
  console.log('Stripe:', results.stripe);
  console.log('OpenAI:', results.openai);

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    results
  });
}