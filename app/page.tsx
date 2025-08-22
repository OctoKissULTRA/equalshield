import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  BarChart3, 
  Download, 
  Users, 
  Zap, 
  FileText,
  ArrowRight,
  CheckCircle,
  Target
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <Shield className="h-8 w-8 text-blue-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">EqualShield</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/trust" className="text-gray-700 hover:text-gray-900">
                Trust
              </Link>
              <Link href="/trial">
                <Button variant="outline" size="sm">Try Free</Button>
              </Link>
              <Link href="/sign-in">
                <Button size="sm">Sign In</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="relative z-10 pb-8 sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32">
            <main className="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
              <div className="sm:text-center lg:text-left">
                <div className="mb-6">
                  <Badge variant="outline" className="mb-4">
                    Engineering-First Accessibility
                  </Badge>
                </div>
                <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
                  <span className="block">Measure WCAG A/AA</span>
                  <span className="block">conformance.</span>
                  <span className="block text-blue-600">Prioritize fixes.</span>
                  <span className="block">Export clean,</span>
                  <span className="block text-blue-600">shareable reports.</span>
                </h1>
                <p className="mt-3 text-base text-gray-500 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                  Automated checks with engineering guidance. Manual review recommended. Not legal advice.
                </p>
                <div className="mt-5 sm:mt-8 sm:flex sm:justify-center lg:justify-start">
                  <div className="rounded-md shadow">
                    <Link href="/trial">
                      <Button size="lg" className="w-full flex items-center justify-center">
                        Run a Free Trial Scan
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                  <div className="mt-3 sm:mt-0 sm:ml-3">
                    <Link href="/trust">
                      <Button variant="outline" size="lg" className="w-full">
                        View Our Trust Page
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-base text-blue-600 font-semibold tracking-wide uppercase">Features</h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Built for Engineering Teams
            </p>
            <p className="mt-4 max-w-2xl text-xl text-gray-500 lg:mx-auto">
              Automated technical testing with actionable guidance. No false promises, just engineering insights.
            </p>
          </div>

          <div className="mt-10">
            <div className="space-y-10 md:space-y-0 md:grid md:grid-cols-3 md:gap-x-8 md:gap-y-10">
              <div className="relative">
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <p className="ml-16 text-lg leading-6 font-medium text-gray-900">WCAG A/AA Analysis</p>
                <p className="mt-2 ml-16 text-base text-gray-500">
                  Comprehensive automated checks against WCAG guidelines with POUR principle scoring.
                </p>
              </div>

              <div className="relative">
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                  <Target className="h-6 w-6" />
                </div>
                <p className="ml-16 text-lg leading-6 font-medium text-gray-900">Actionable Fixes</p>
                <p className="mt-2 ml-16 text-base text-gray-500">
                  Code-level suggestions and implementation guidance. Engineering guidance, not legal advice.
                </p>
              </div>

              <div className="relative">
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                  <FileText className="h-6 w-6" />
                </div>
                <p className="ml-16 text-lg leading-6 font-medium text-gray-900">Professional Reports</p>
                <p className="mt-2 ml-16 text-base text-gray-500">
                  Clean PDF exports and shareable links for stakeholders and compliance documentation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Social Proof */}
      <div className="bg-gray-50">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:py-16 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:gap-8 lg:items-center">
            <div>
              <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
                Trusted by Engineering Teams
              </h2>
              <p className="mt-3 max-w-3xl text-lg text-gray-500">
                Automated WCAG testing & engineering guidance; not legal advice.
              </p>
              <div className="mt-8 sm:flex">
                <div className="rounded-md shadow">
                  <Link href="/trial">
                    <Button size="lg">
                      Get Started Free
                    </Button>
                  </Link>
                </div>
                <div className="mt-3 sm:mt-0 sm:ml-3">
                  <Link href="/trust">
                    <Button variant="outline" size="lg">
                      See Our Results
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-0.5 md:grid-cols-2 lg:mt-0 lg:grid-cols-2">
              <Card className="col-span-1">
                <CardContent className="p-6 text-center">
                  <div className="text-2xl font-bold text-blue-600">50+</div>
                  <p className="text-sm text-gray-600">Pages per scan</p>
                </CardContent>
              </Card>
              <Card className="col-span-1">
                <CardContent className="p-6 text-center">
                  <div className="text-2xl font-bold text-blue-600">5min</div>
                  <p className="text-sm text-gray-600">Average scan time</p>
                </CardContent>
              </Card>
              <Card className="col-span-1">
                <CardContent className="p-6 text-center">
                  <div className="text-2xl font-bold text-blue-600">WCAG</div>
                  <p className="text-sm text-gray-600">A/AA compliant</p>
                </CardContent>
              </Card>
              <Card className="col-span-1">
                <CardContent className="p-6 text-center">
                  <div className="text-2xl font-bold text-blue-600">100%</div>
                  <p className="text-sm text-gray-600">Automated</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white">
        <div className="max-w-7xl mx-auto py-12 px-4 overflow-hidden sm:px-6 lg:px-8">
          <div className="flex justify-center space-x-6">
            <Link href="/trust" className="text-gray-400 hover:text-gray-500">
              Trust & Transparency
            </Link>
            <Link href="/trial" className="text-gray-400 hover:text-gray-500">
              Free Trial
            </Link>
          </div>
          <p className="mt-8 text-center text-base text-gray-400">
            &copy; 2025 EqualShield. Automated WCAG testing & engineering guidance; not legal advice.
          </p>
        </div>
      </footer>
    </div>
  );
}