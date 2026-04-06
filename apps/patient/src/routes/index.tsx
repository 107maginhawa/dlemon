import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@monobase/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@monobase/ui/components/card'
import { Badge } from '@monobase/ui/components/badge'
import { Logo } from "@/components/logo"
import {
  Shield,
  Users,
  Activity,
  Calendar,
  ArrowRight,
  Lock
} from "lucide-react"
import { requireGuest } from '@/utils/guards'

export const Route = createFileRoute('/')({
  beforeLoad: requireGuest,
  component: HomePage,
})

function HomePage() {
  const features = [
    {
      id: 'appointments',
      name: 'Book Appointments',
      description: 'Schedule appointments with healthcare providers easily and conveniently',
      icon: Calendar,
      color: 'bg-blue-500',
    },
    {
      id: 'records',
      name: 'Health Records',
      description: 'Access your medical records, lab results, and health data securely',
      icon: Activity,
      color: 'bg-green-500',
    },
    {
      id: 'providers',
      name: 'Find Providers',
      description: 'Search and connect with healthcare providers in your area',
      icon: Users,
      color: 'bg-purple-500',
    }
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <Logo variant="horizontal" size="lg" />
            </div>
            <div className="flex items-center space-x-4">
              <Link
                to="/auth/sign-in"
                className="text-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Sign In
              </Link>
              <Link to="/auth/sign-up">
                <Button>
                  Create Account
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-card py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge variant="outline" className="mb-4">
            <Shield className="w-3 h-3 mr-1" />
            Secure Healthcare Platform
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Your Digital Healthcare Companion
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Access your health records, book appointments, and connect with healthcare providers all in one secure platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth/sign-in">
              <Button size="lg" className="min-w-[200px]">
                Sign In
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link to="/auth/sign-up">
              <Button variant="outline" size="lg" className="min-w-[200px]">
                Create Account
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground mt-6">
            <Lock className="w-4 h-4 inline mr-1" />
            HIPAA compliant • 256-bit encryption • Multi-factor authentication
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Healthcare Made Simple
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to manage your healthcare journey
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature) => (
              <Card key={feature.id}>
                <CardHeader>
                  <div className={`w-12 h-12 ${feature.color} rounded-lg flex items-center justify-center mb-4`}>
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle className="text-xl">
                    {feature.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center space-y-4">
            <Logo variant="horizontal" size="md" />
            <p className="text-sm text-muted-foreground">
              © 2024 Monobase Healthcare. All rights reserved.
            </p>
            <div className="flex items-center space-x-6 text-xs text-muted-foreground">
              <span>HIPAA Compliant</span>
              <span>•</span>
              <span>SOC 2 Type II</span>
              <span>•</span>
              <span>ISO 27001</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
