'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { 
  ArrowRight, 
  Shield, 
  Heart, 
  Zap, 
  Target, 
  CheckCircle, 
  TrendingUp,
  Users,
  Globe,
  Sparkles,
  BadgeCheck,
  Quote,
  Building
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function HomePage() {
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleScan = async () => {
    if (!url || !email) {
      alert('Please provide your website URL and email to begin your accessibility journey');
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
    <main className="min-h-screen bg-equalshield-light">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-equalshield-accent/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Image 
                src="/logo.png" 
                alt="EqualShield" 
                width={32} 
                height={32}
                className="mr-3"
              />
              <span className="text-xl font-bold text-equalshield-primary">EqualShield</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#solution" className="text-equalshield-primary hover:text-primary transition-colors">Solution</a>
              <a href="#pricing" className="text-equalshield-primary hover:text-primary transition-colors">Pricing</a>
              <Button variant="outline" size="sm" className="border-equalshield-primary text-equalshield-primary">
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-equalshield-subtle opacity-30"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            {/* Trust Badge */}
            <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur border border-equalshield-accent/50 px-4 py-2 rounded-full mb-8">
              <Heart className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium text-equalshield-primary">Trusted by companies who believe accessibility is leadership</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-equalshield-primary mb-8 leading-tight">
              Welcome Everyone.
              <br />
              <span className="text-gradient-equalshield">Shield Everything.</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-equalshield-primary/80 mb-6 max-w-4xl mx-auto leading-relaxed">
              <strong>Your website should work for all 61 million Americans with disabilities.</strong>
              <br />
              EqualShield ensures it does — protecting your compliance while empowering every user.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button 
                size="lg" 
                className="bg-equalshield-primary hover:bg-equalshield-primary/90 text-white px-8 py-4 text-lg"
                onClick={() => document.getElementById('scanner')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Start Your Free Accessibility Scan
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                className="border-equalshield-primary text-equalshield-primary hover:bg-equalshield-primary/5 px-8 py-4 text-lg"
              >
                See How Leaders Use EqualShield
              </Button>
            </div>

            {/* Trusted By Logos Placeholder */}
            <div className="flex justify-center items-center gap-8 opacity-60">
              <div className="w-24 h-12 bg-equalshield-primary/10 rounded flex items-center justify-center">
                <Building className="w-6 h-6 text-equalshield-primary" />
              </div>
              <div className="w-24 h-12 bg-equalshield-primary/10 rounded flex items-center justify-center">
                <Globe className="w-6 h-6 text-equalshield-primary" />
              </div>
              <div className="w-24 h-12 bg-equalshield-primary/10 rounded flex items-center justify-center">
                <Users className="w-6 h-6 text-equalshield-primary" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Scanner Section */}
      <section id="scanner" className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="p-8 shadow-xl border-equalshield-accent/20">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-equalshield-primary mb-4">
                Discover Your Accessibility Impact
              </h2>
              <p className="text-equalshield-primary/70">
                Get instant insights into who you're helping and how to help more people.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-equalshield-primary mb-2">
                  Website URL
                </label>
                <Input
                  type="url"
                  placeholder="https://your-amazing-site.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="border-equalshield-accent focus:border-equalshield-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-equalshield-primary mb-2">
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="leader@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-equalshield-accent focus:border-equalshield-primary"
                />
              </div>
            </div>
            
            <Button
              onClick={handleScan}
              disabled={loading}
              size="lg"
              className="w-full mt-6 bg-equalshield-primary hover:bg-equalshield-primary/90 text-white py-4"
            >
              {loading ? (
                <>
                  <Sparkles className="animate-spin mr-2 h-5 w-5" />
                  Analyzing Your Impact...
                </>
              ) : (
                <>
                  Start Free Scan — See Your Shield Score
                  <Shield className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
            
            <p className="text-center text-sm text-equalshield-primary/60 mt-4">
              No credit card. Just conviction. Results in 30 seconds.
            </p>
          </Card>
        </div>
      </section>

      {/* The Problem (But Positive) */}
      <section className="py-20 bg-equalshield-light">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-equalshield-primary mb-8">
              97% of Websites Fail Basic Accessibility
            </h2>
            <p className="text-xl text-equalshield-primary/80 mb-6">
              <strong>That's 97% missing out on $13 trillion in annual disposable income.</strong>
            </p>
            <p className="text-lg text-equalshield-primary/70 max-w-4xl mx-auto">
              But this isn't about numbers. It's about that customer using a screen reader 
              who can't buy your product. The employee with low vision who can't use your 
              tools. The grandparent who can't read your menu.
            </p>
          </div>
          
          <div className="text-center">
            <div className="inline-block bg-white px-8 py-4 rounded-2xl shadow-sm border border-equalshield-accent/20">
              <p className="text-2xl font-bold text-equalshield-primary">
                <span className="text-gradient-equalshield">Accessibility isn't just compliance. It's completion.</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The Solution */}
      <section id="solution" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-equalshield-primary mb-6">
              Your Shield. Their Access. Everyone Wins.
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="p-6 text-center border-equalshield-accent/20 hover:shadow-lg transition-shadow">
              <div className="bg-equalshield-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-equalshield-primary" />
              </div>
              <h3 className="text-xl font-bold text-equalshield-primary mb-3">🛡️ Continuous Protection</h3>
              <p className="text-equalshield-primary/70">
                AI-powered scanning that never sleeps. Know about issues before anyone else does.
              </p>
            </Card>
            
            <Card className="p-6 text-center border-equalshield-accent/20 hover:shadow-lg transition-shadow">
              <div className="bg-equalshield-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-equalshield-primary" />
              </div>
              <h3 className="text-xl font-bold text-equalshield-primary mb-3">♿ Real Impact Metrics</h3>
              <p className="text-equalshield-primary/70">
                Not just WCAG scores — understand exactly who you're helping and how.
              </p>
            </Card>
            
            <Card className="p-6 text-center border-equalshield-accent/20 hover:shadow-lg transition-shadow">
              <div className="bg-equalshield-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <BadgeCheck className="w-8 h-8 text-equalshield-primary" />
              </div>
              <h3 className="text-xl font-bold text-equalshield-primary mb-3">🤝 Inclusion Reporting</h3>
              <p className="text-equalshield-primary/70">
                Share your accessibility journey. Turn compliance into competitive advantage.
              </p>
            </Card>
            
            <Card className="p-6 text-center border-equalshield-accent/20 hover:shadow-lg transition-shadow">
              <div className="bg-equalshield-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-equalshield-primary" />
              </div>
              <h3 className="text-xl font-bold text-equalshield-primary mb-3">🎯 Actionable Fixes</h3>
              <p className="text-equalshield-primary/70">
                Every issue comes with the exact code to fix it. No expertise required.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 bg-equalshield-light">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-equalshield-primary mb-12">
            What Smart Leaders Say
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-6 border-equalshield-accent/20">
              <Quote className="w-8 h-8 text-equalshield-accent mb-4" />
              <p className="text-equalshield-primary/80 mb-4">
                "EqualShield helped us realize accessibility wasn't a checkbox — 
                it was 15% of our market we were ignoring."
              </p>
              <div className="font-semibold text-equalshield-primary">
                — Sarah Chen, CTO at TechCorp
              </div>
            </Card>
            
            <Card className="p-6 border-equalshield-accent/20">
              <Quote className="w-8 h-8 text-equalshield-accent mb-4" />
              <p className="text-equalshield-primary/80 mb-4">
                "We display our EqualShield badge proudly. It shows we give a damn."
              </p>
              <div className="font-semibold text-equalshield-primary">
                — Marcus Johnson, Founder of StartupXYZ
              </div>
            </Card>
            
            <Card className="p-6 border-equalshield-accent/20">
              <Quote className="w-8 h-8 text-equalshield-accent mb-4" />
              <p className="text-equalshield-primary/80 mb-4">
                "Turned our biggest legal risk into our best PR story."
              </p>
              <div className="font-semibold text-equalshield-primary">
                — Jennifer Walsh, General Counsel at RetailGiant
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing (Reframed) */}
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-equalshield-primary mb-6">
              Invest in Inclusion
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Advocate Plan */}
            <Card className="p-8 border-equalshield-accent/20 hover:shadow-xl transition-shadow">
              <div className="text-center mb-6">
                <div className="text-2xl mb-2">🌱</div>
                <h3 className="text-2xl font-bold text-equalshield-primary mb-2">Advocate</h3>
                <div className="text-4xl font-bold text-equalshield-primary">$49<span className="text-lg font-normal text-equalshield-primary/60">/mo</span></div>
                <p className="text-equalshield-primary/70 mt-2">Perfect for small businesses taking the first step</p>
              </div>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-equalshield-primary/80">Weekly accessibility monitoring</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-equalshield-primary/80">Up to 10,000 page views</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-equalshield-primary/80">Basic WCAG 2.1 compliance</span>
                </li>
              </ul>
              
              <div className="bg-equalshield-light p-4 rounded-lg mb-6">
                <p className="text-sm font-semibold text-equalshield-primary">
                  <strong>Impact:</strong> Protect 1 in 4 Americans
                </p>
              </div>
              
              <Button className="w-full bg-equalshield-primary hover:bg-equalshield-primary/90 text-white">
                Start Free Trial
              </Button>
            </Card>

            {/* Guardian Plan */}
            <Card className="p-8 border-equalshield-primary/50 shadow-xl relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-equalshield-primary text-white px-4 py-1 rounded-full text-sm font-semibold">
                  Most Popular
                </span>
              </div>
              
              <div className="text-center mb-6">
                <div className="text-2xl mb-2">🛡️</div>
                <h3 className="text-2xl font-bold text-equalshield-primary mb-2">Guardian</h3>
                <div className="text-4xl font-bold text-equalshield-primary">$149<span className="text-lg font-normal text-equalshield-primary/60">/mo</span></div>
                <p className="text-equalshield-primary/70 mt-2">For companies serious about digital inclusion</p>
              </div>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-equalshield-primary/80">Daily monitoring + AI analysis</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-equalshield-primary/80">Up to 50,000 page views</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-equalshield-primary/80">Legal risk assessment</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-equalshield-primary/80">Public accessibility badge</span>
                </li>
              </ul>
              
              <div className="bg-equalshield-light p-4 rounded-lg mb-6">
                <p className="text-sm font-semibold text-equalshield-primary">
                  <strong>Impact:</strong> Open doors for millions
                </p>
              </div>
              
              <Button className="w-full bg-equalshield-primary hover:bg-equalshield-primary/90 text-white">
                Start Free Trial
              </Button>
            </Card>

            {/* Champion Plan */}
            <Card className="p-8 border-equalshield-accent/20 hover:shadow-xl transition-shadow">
              <div className="text-center mb-6">
                <div className="text-2xl mb-2">🏆</div>
                <h3 className="text-2xl font-bold text-equalshield-primary mb-2">Champion</h3>
                <div className="text-4xl font-bold text-equalshield-primary">$399<span className="text-lg font-normal text-equalshield-primary/60">/mo</span></div>
                <p className="text-equalshield-primary/70 mt-2">For accessibility leaders and enterprises</p>
              </div>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-equalshield-primary/80">Real-time monitoring</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-equalshield-primary/80">Unlimited page views</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-equalshield-primary/80">Direct fix generation</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-equalshield-primary/80">Quarterly inclusion reports</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-equalshield-primary/80">White-label options</span>
                </li>
              </ul>
              
              <div className="bg-equalshield-light p-4 rounded-lg mb-6">
                <p className="text-sm font-semibold text-equalshield-primary">
                  <strong>Impact:</strong> Set the industry standard
                </p>
              </div>
              
              <Button className="w-full bg-equalshield-primary hover:bg-equalshield-primary/90 text-white">
                Start Free Trial
              </Button>
            </Card>
          </div>
          
          <div className="text-center mt-8">
            <p className="text-equalshield-primary/70">
              <strong>Start Free</strong> — No credit card. Just conviction.
            </p>
          </div>
        </div>
      </section>

      {/* The Badge */}
      <section className="py-20 bg-equalshield-light">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-equalshield-primary mb-6">
            The EqualShield Badge
          </h2>
          <p className="text-xl text-equalshield-primary/80 mb-12">
            <strong>Turn compliance into credibility.</strong>
          </p>
          
          <Card className="max-w-2xl mx-auto p-8 border-equalshield-accent/20">
            <div className="bg-white border border-equalshield-accent/50 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-center space-x-3">
                <Shield className="w-6 h-6 text-equalshield-primary" />
                <span className="font-semibold text-equalshield-primary">♿ Accessibility Monitored by EqualShield</span>
              </div>
              <div className="text-sm text-equalshield-primary/70 mt-2">
                Score: 94/100 | Last checked: Today
              </div>
            </div>
            
            <p className="text-equalshield-primary/70 mb-4">
              Every badge links to your public accessibility statement.
            </p>
            <p className="text-sm text-equalshield-primary/60">
              SEO juice + social proof + actual impact.
            </p>
          </Card>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-equalshield-primary mb-6">
            Be the Shield. Be the Standard.
          </h2>
          
          <div className="space-y-4 text-lg text-equalshield-primary/80 mb-12">
            <p>Your competitors are one lawsuit away from headlines.</p>
            <p>You're one scan away from leadership.</p>
            <p>The question isn't whether to care about accessibility.</p>
            <p><strong>It's whether to lead with it.</strong></p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button 
              size="lg" 
              className="bg-equalshield-primary hover:bg-equalshield-primary/90 text-white px-8 py-4"
              onClick={() => document.getElementById('scanner')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Start Your Free Scan
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              className="border-equalshield-primary text-equalshield-primary hover:bg-equalshield-primary/5 px-8 py-4"
            >
              Talk to Our Team
            </Button>
          </div>
          
          <div className="bg-equalshield-light p-6 rounded-xl">
            <p className="text-equalshield-primary/80 mb-2">
              <strong>26% of adults have a disability.</strong>
            </p>
            <p className="text-equalshield-primary/80 mb-4">
              <strong>100% of humans deserve dignity.</strong>
            </p>
            <p className="text-2xl font-bold text-gradient-equalshield">
              Welcome everyone.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-equalshield-primary text-equalshield-light py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <Image 
                  src="/logo.png" 
                  alt="EqualShield" 
                  width={24} 
                  height={24}
                  className="mr-2 brightness-0 invert"
                />
                <span className="text-lg font-bold">EqualShield</span>
              </div>
              <p className="text-equalshield-light/70">
                Making the web accessible for everyone.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-equalshield-light/70">
                <li><a href="#" className="hover:text-equalshield-light transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-equalshield-light transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-equalshield-light transition-colors">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-equalshield-light/70">
                <li><a href="#" className="hover:text-equalshield-light transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-equalshield-light transition-colors">Guides</a></li>
                <li><a href="#" className="hover:text-equalshield-light transition-colors">Blog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-equalshield-light/70">
                <li><a href="#" className="hover:text-equalshield-light transition-colors">About</a></li>
                <li><a href="#" className="hover:text-equalshield-light transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-equalshield-light transition-colors">Privacy</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-equalshield-light/20 mt-8 pt-8 text-center text-equalshield-light/70">
            <p>&copy; 2025 EqualShield. All rights reserved. Making accessibility accessible.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}