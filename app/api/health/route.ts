export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    env_check: {
      stripe: Boolean(process.env.STRIPE_SECRET_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY),
      database: Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL),
    }
  });
}