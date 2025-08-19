import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import OpenAI from 'openai';

export async function GET() {
  const results: {
    supabase: { status: string; data: any; error: string | null };
    stripe: { status: string; data: any; error: string | null };
    openai: { status: string; data: any; error: string | null };
  } = {
    supabase: { status: 'not_tested', data: null, error: null },
    stripe: { status: 'not_tested', data: null, error: null },
    openai: { status: 'not_tested', data: null, error: null }
  };

  // Test Supabase
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      results.supabase = {
        status: 'error',
        data: null,
        error: 'Missing Supabase environment variables'
      };
    } else {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Try to select from a table (will fail if table doesn't exist but connection will work)
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .limit(1);
      
      results.supabase = {
        status: error ? 'error' : 'success',
        data: data || 'Connected successfully',
        error: error?.message || null
      };
    }
  } catch (error) {
    results.supabase = {
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
        max_tokens: 20
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
  console.log('Supabase:', results.supabase);
  console.log('Stripe:', results.stripe);
  console.log('OpenAI:', results.openai);

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    results
  });
}