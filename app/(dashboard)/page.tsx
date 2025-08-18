'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, Shield, FileText, Award, Building2, Scale, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleScan = async () => {
    if (!url || !email) {
      alert('Please provide your website URL and email to begin the compliance assessment');
      return;
    }
    
    setLoading(true);
    
    // Save to localStorage for the scanner page
    localStorage.setItem('scanUrl', url);
    localStorage.setItem('scanEmail', email);
    
    // Redirect to scanning page
    router.push('/scan');
  };

  return (
    <main className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            {/* Trust Badge */}
            <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-full mb-8">
              <Shield className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-700">WCAG 2.1 AA Certified Assessment</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">
              Enterprise ADA Compliance
              <br />
              <span className="text-emerald-600">Simplified & Verified</span>
            </h1>
            
            <p className="text-xl text-slate-600 mb-4 max-w-3xl mx-auto">
              Comprehensive digital accessibility assessment aligned with Title III of the Americans with Disabilities Act 
              and Section 508 of the Rehabilitation Act.
            </p>
            
            <p className="text-lg text-slate-500 mb-12 max-w-2xl mx-auto">
              Generate VPAT documentation, achieve WCAG 2.1 compliance, and meet federal contracting requirements.
            </p>

            {/* Professional Scanner Form */}
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="text-lg font-semibold text-slate-900 mb-6">Request Compliance Assessment</h2>
              <div className="space-y-4">
                <div className="text-left">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Website URL</label>
                  <Input
                    type="url"
                    placeholder="https://yourorganization.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full bg-white border-gray-300 text-slate-900"
                    required
                  />
                </div>
                <div className="text-left">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Business Email</label>
                  <Input
                    type="email"
                    placeholder="compliance@yourorganization.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white border-gray-300 text-slate-900"
                    required
                  />
                </div>
                
                <Button
                  onClick={handleScan}
                  disabled={loading}
                  size="lg"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {loading ? (
                    'Initializing Assessment...'
                  ) : (
                    <>
                      Begin Compliance Assessment
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
                
                <p className="text-xs text-slate-500 text-center">
                  Complimentary initial assessment • No payment required • Enterprise solutions available
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Regulatory Framework Section */}
      <section className="py-16 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">
            Comprehensive Regulatory Coverage
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="bg-slate-50 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Scale className="w-8 h-8 text-slate-700" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">ADA Title III</h3>
              <p className="text-sm text-slate-600">Public accommodation compliance for digital properties</p>
            </div>
            <div className="text-center">
              <div className="bg-slate-50 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-slate-700" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Section 508</h3>
              <p className="text-sm text-slate-600">Federal agency electronic and IT accessibility</p>
            </div>
            <div className="text-center">
              <div className="bg-slate-50 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Award className="w-8 h-8 text-slate-700" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">WCAG 2.1 AA</h3>
              <p className="text-sm text-slate-600">International web content accessibility guidelines</p>
            </div>
            <div className="text-center">
              <div className="bg-slate-50 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-slate-700" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">EN 301 549</h3>
              <p className="text-sm text-slate-600">European accessibility standard compliance</p>
            </div>
          </div>
        </div>
      </section>

      {/* Professional Services Section */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-4">
            Enterprise Compliance Solutions
          </h2>
          <p className="text-lg text-center text-slate-600 mb-12 max-w-3xl mx-auto">
            Trusted by Fortune 500 companies, government agencies, and educational institutions 
            to maintain digital accessibility compliance.
          </p>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-xl border border-gray-200">
              <div className="bg-emerald-100 w-12 h-12 rounded-lg flex items-center justify-center mb-6">
                <Shield className="w-6 h-6 text-emerald-700" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Technical Assessment</h3>
              <p className="text-slate-600 mb-4">
                Comprehensive automated and manual testing against WCAG 2.1 Level AA success criteria.
              </p>
              <ul className="space-y-2">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">Automated testing of all pages</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">Manual keyboard navigation review</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">Screen reader compatibility testing</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-white p-8 rounded-xl border border-gray-200">
              <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-6">
                <FileText className="w-6 h-6 text-blue-700" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">VPAT Documentation</h3>
              <p className="text-slate-600 mb-4">
                Generate Voluntary Product Accessibility Template documentation for procurement requirements.
              </p>
              <ul className="space-y-2">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">Section 508 VPAT® 2.5</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">WCAG Edition documentation</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">EN 301 549 conformance reports</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-white p-8 rounded-xl border border-gray-200">
              <div className="bg-purple-100 w-12 h-12 rounded-lg flex items-center justify-center mb-6">
                <Award className="w-6 h-6 text-purple-700" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Remediation Support</h3>
              <p className="text-slate-600 mb-4">
                Expert guidance and implementation support to achieve and maintain compliance.
              </p>
              <ul className="space-y-2">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">Prioritized remediation roadmap</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">Technical implementation guidance</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">Quarterly compliance monitoring</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="py-16 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-slate-900">2,400+</div>
              <div className="text-sm text-slate-600 mt-1">Enterprise Clients</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-slate-900">98%</div>
              <div className="text-sm text-slate-600 mt-1">Compliance Success Rate</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-slate-900">ISO 27001</div>
              <div className="text-sm text-slate-600 mt-1">Security Certified</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-slate-900">24/7</div>
              <div className="text-sm text-slate-600 mt-1">Monitoring & Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            Ensure Digital Accessibility Compliance
          </h2>
          <p className="text-lg text-slate-600 mb-8">
            Join leading organizations in maintaining ADA compliance and creating inclusive digital experiences.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Start Assessment
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Schedule Consultation
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
