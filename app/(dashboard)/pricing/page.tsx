'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { CheckCircle, ArrowRight, Shield, Building2, Globe } from 'lucide-react';
import { checkoutAction } from '@/lib/payments/actions';

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Enterprise Compliance Solutions
          </h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Comprehensive accessibility compliance platform with expert support, 
            automated monitoring, and VPAT documentation generation.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Professional Plan */}
          <Card className="relative border-gray-200">
            <CardHeader className="pb-8">
              <div className="flex items-center justify-between mb-4">
                <Shield className="w-10 h-10 text-slate-700" />
                <span className="text-sm font-medium text-slate-600">Most Popular</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Professional</h2>
              <p className="text-slate-600 mt-2">For growing organizations</p>
              <div className="mt-6">
                <span className="text-4xl font-bold text-slate-900">$997</span>
                <span className="text-slate-600">/month</span>
              </div>
              <p className="text-sm text-slate-500 mt-2">Billed annually, or $1,197/mo monthly</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <h4 className="font-semibold text-slate-900">Compliance Features</h4>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-600">Monthly automated WCAG 2.1 AA scanning</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-600">Up to 500 pages monitored</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-600">Quarterly compliance reports</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-600">Basic VPAT documentation</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-600">Email support (48hr response)</span>
                  </li>
                </ul>
              </div>
              
              <form action={checkoutAction}>
                <input type="hidden" name="priceId" value="price_professional" />
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" size="lg">
                  Start 30-Day Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Enterprise Plan */}
          <Card className="relative border-emerald-600 border-2 shadow-lg">
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="bg-emerald-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                Recommended
              </span>
            </div>
            <CardHeader className="pb-8 pt-8">
              <div className="flex items-center justify-between mb-4">
                <Building2 className="w-10 h-10 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-600">Best Value</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Enterprise</h2>
              <p className="text-slate-600 mt-2">For regulated industries</p>
              <div className="mt-6">
                <span className="text-4xl font-bold text-slate-900">$2,497</span>
                <span className="text-slate-600">/month</span>
              </div>
              <p className="text-sm text-slate-500 mt-2">Billed annually, or $2,997/mo monthly</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <h4 className="font-semibold text-slate-900">Everything in Professional, plus:</h4>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-600">Weekly automated scanning</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-600">Unlimited pages monitored</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-600">Complete VPAT® 2.5 documentation</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-600">Manual accessibility audits (quarterly)</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-600">Priority support with SLA</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-600">Remediation guidance & code samples</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-600">Legal compliance documentation</span>
                  </li>
                </ul>
              </div>
              
              <form action={checkoutAction}>
                <input type="hidden" name="priceId" value="price_enterprise" />
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" size="lg">
                  Start 30-Day Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Global Plan */}
          <Card className="relative border-gray-200">
            <CardHeader className="pb-8">
              <div className="flex items-center justify-between mb-4">
                <Globe className="w-10 h-10 text-slate-700" />
                <span className="text-sm font-medium text-slate-600">Custom</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Global</h2>
              <p className="text-slate-600 mt-2">For multinational corporations</p>
              <div className="mt-6">
                <span className="text-3xl font-bold text-slate-900">Custom Pricing</span>
              </div>
              <p className="text-sm text-slate-500 mt-2">Tailored to your requirements</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <h4 className="font-semibold text-slate-900">Everything in Enterprise, plus:</h4>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-600">Daily automated scanning</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-600">Multi-domain & multi-language support</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-600">EN 301 549 & international compliance</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-600">Dedicated accessibility consultant</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-600">Custom integrations & API access</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-600">On-site training & workshops</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-600">White-glove implementation</span>
                  </li>
                </ul>
              </div>
              
              <Button variant="outline" className="w-full border-slate-300" size="lg">
                Contact Sales
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ROI Section */}
      <section className="bg-white py-16 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">
            Return on Investment
          </h2>
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-emerald-600 mb-2">87%</div>
              <div className="text-lg font-semibold text-slate-900">Risk Reduction</div>
              <p className="text-sm text-slate-600 mt-2">
                Average reduction in legal exposure for compliant organizations
              </p>
            </div>
            <div>
              <div className="text-3xl font-bold text-emerald-600 mb-2">$250K+</div>
              <div className="text-lg font-semibold text-slate-900">Cost Avoidance</div>
              <p className="text-sm text-slate-600 mt-2">
                Average settlement costs avoided through proactive compliance
              </p>
            </div>
            <div>
              <div className="text-3xl font-bold text-emerald-600 mb-2">23%</div>
              <div className="text-lg font-semibold text-slate-900">Market Expansion</div>
              <p className="text-sm text-slate-600 mt-2">
                Increased reach to users with disabilities worldwide
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-slate-900 mb-2">
                What compliance standards do you support?
              </h3>
              <p className="text-slate-600">
                We support WCAG 2.1 Level AA, Section 508, ADA Title III, EN 301 549, 
                and can customize assessments for specific industry requirements.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-slate-900 mb-2">
                How does the 30-day trial work?
              </h3>
              <p className="text-slate-600">
                You get full access to all features in your selected plan for 30 days. 
                No credit card required to start. Cancel anytime.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-slate-900 mb-2">
                Do you provide remediation services?
              </h3>
              <p className="text-slate-600">
                Yes, our Enterprise and Global plans include remediation guidance. 
                We also offer professional services for hands-on implementation support.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-slate-900 mb-2">
                Is this better than overlay solutions?
              </h3>
              <p className="text-slate-600">
                Yes. We provide real compliance through source-code level remediation, 
                not superficial overlays. This ensures genuine accessibility and legal protection.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
