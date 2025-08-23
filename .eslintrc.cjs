module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'next/core-web-vitals',
    'plugin:@typescript-eslint/recommended'
  ],
  rules: {
    // Prevent importing server-only modules in client components
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '@/lib/config/env',
            message: 'Environment config is server-only. Use NEXT_PUBLIC_ prefixed vars for client-side.'
          },
          {
            name: 'fs',
            message: 'Node.js fs module cannot be used in client-side code.'
          },
          {
            name: 'path',
            message: 'Node.js path module cannot be used in client-side code.'
          },
          {
            name: 'crypto',
            message: 'Node.js crypto module cannot be used in client-side code. Use Web Crypto API instead.'
          }
        ]
      }
    ],
    
    // Prevent process.env usage in client components
    'no-restricted-globals': [
      'error',
      {
        name: 'process',
        message: 'process.env should not be accessed directly. Use @/lib/config/env on server-side only.'
      }
    ],
    
    // Warn on console.log in production code
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    
    // TypeScript specific rules
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-module-boundary-types': 'off'
  },
  
  overrides: [
    // Stricter rules for client-side components
    {
      files: ['**/*.client.{ts,tsx}', '**/components/**/*.{ts,tsx}', 'app/**/*.tsx'],
      excludedFiles: ['**/*.server.{ts,tsx}', '**/api/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: '@/lib/config/env',
                message: 'Environment config is server-only. Client components should use props or context.'
              },
              {
                name: '@/lib/supabase/server',
                message: 'Server-side Supabase client cannot be used in client components.'
              },
              {
                name: 'stripe',
                message: 'Stripe SDK is server-only. Use Stripe.js for client-side.'
              }
            ]
          }
        ]
      }
    },
    
    // Allow process.env in config files
    {
      files: ['*.config.{js,ts}', 'scripts/**/*.{js,ts}'],
      rules: {
        'no-restricted-globals': 'off'
      }
    }
  ]
};