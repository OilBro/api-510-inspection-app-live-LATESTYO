import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { Link, useLocation } from "wouter";
import { Settings, FileText, Upload, Calculator, BarChart3, GitCompare, AlertTriangle, Smartphone } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { AnomalyStats } from "@/components/AnomalyStats";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-md w-full mx-auto p-8">
          <div className="text-center mb-8">
            <Settings className="h-16 w-16 text-primary mx-auto mb-4" />
            <h1 className="text-4xl font-bold text-gray-900 mb-2">{APP_TITLE}</h1>
            <p className="text-lg text-gray-600">Professional Pressure Vessel Inspection System</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Welcome</CardTitle>
              <CardDescription>
                Sign in to access your inspection records, perform calculations, and generate comprehensive reports.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full" size="lg">
                <a href={getLoginUrl()}>Sign In</a>
              </Button>
            </CardContent>
          </Card>

          <div className="mt-8 grid grid-cols-2 gap-4 text-center">
            <div className="p-4 bg-white rounded-lg shadow-sm">
              <Calculator className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium">ASME Calculations</p>
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm">
              <FileText className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium">Report Generation</p>
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm">
              <Upload className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium">PDF/Excel Import</p>
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm">
              <BarChart3 className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium">Data Analysis</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Settings className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-gray-900">{APP_TITLE}</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {user?.name || user?.email}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h2>
          <p className="text-gray-600">Manage your pressure vessel inspections and generate reports</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link href="/inspections">
              <CardHeader>
                <FileText className="h-10 w-10 text-primary mb-2" />
                <CardTitle>My Inspections</CardTitle>
                <CardDescription>View and manage all inspection records</CardDescription>
              </CardHeader>
            </Link>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link href="/inspections/new">
              <CardHeader>
                <Settings className="h-10 w-10 text-green-600 mb-2" />
                <CardTitle>New Inspection</CardTitle>
                <CardDescription>Create a new inspection record</CardDescription>
              </CardHeader>
            </Link>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setLocation("/import")}>
            <CardHeader>
              <Upload className="h-12 w-12 text-blue-600 mb-4" />
              <CardTitle>Import Data</CardTitle>
              <CardDescription>
                Upload PDF or Excel files to import inspection data
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link href="/import-pdf">
              <CardHeader>
                <Upload className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Import from PDF (AI)</CardTitle>
                <CardDescription>
                  Upload inspection report PDF and automatically extract all data using AI
                </CardDescription>
              </CardHeader>
            </Link>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link href="/upload-ut-results">
              <CardHeader>
                <Upload className="h-10 w-10 text-green-600 mb-2" />
                <CardTitle>Upload UT Results</CardTitle>
                <CardDescription>
                  Add new ultrasonic thickness measurements to an existing inspection
                </CardDescription>
              </CardHeader>
            </Link>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setLocation("/calculation-worksheet")}>
            <CardHeader>
              <Calculator className="h-12 w-12 text-purple-600 mb-4" />
              <CardTitle>Calculation Worksheet</CardTitle>
              <CardDescription>
                Interactive worksheet with live calculations for shell and head evaluations
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setLocation("/field-inspector")}>
            <CardHeader>
              <Smartphone className="h-12 w-12 text-teal-600 mb-4" />
              <CardTitle>Field Inspector</CardTitle>
              <CardDescription>
                Mobile app for capturing thickness readings on-site with offline support
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setLocation("/comparison")}>
            <CardHeader>
              <GitCompare className="h-12 w-12 text-orange-600 mb-4" />
              <CardTitle>Report Comparison</CardTitle>
              <CardDescription>
                Compare multiple inspection reports to identify thickness trends and degradation patterns
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setLocation("/calculator")}>
            <CardHeader>
              <Calculator className="h-12 w-12 text-indigo-600 mb-4" />
              <CardTitle>API 510 Calculator</CardTitle>
              <CardDescription>
                Interactive ASME calculations for shell, head, MAWP, corrosion rate, and remaining life
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Anomaly Statistics */}
          <AnomalyStats />

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/inspections/new">
                  <Settings className="mr-2 h-4 w-4" />
                  Create New Inspection
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/inspections">
                  <FileText className="mr-2 h-4 w-4" />
                  View All Inspections
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Features</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start">
                  <span className="text-primary mr-2">✓</span>
                  <span>ASME Section VIII compliant calculations</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">✓</span>
                  <span>Automatic data persistence and backup</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">✓</span>
                  <span>PDF and Excel file import with parsing</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">✓</span>
                  <span>Auto-fill across inspection sections</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">✓</span>
                  <span>Comprehensive report generation</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

