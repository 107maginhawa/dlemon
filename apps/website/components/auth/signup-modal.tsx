'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@monobase/ui/components/dialog"
import { Button } from "@monobase/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@monobase/ui/components/card"
import { 
  Users, 
  Stethoscope,
  Video,
  Calendar,
  CreditCard,
  Clock,
  Shield,
  PillIcon,
  ArrowRight
} from 'lucide-react'
import { patientSignupUrl, providerSignupUrl } from '@/utils/config'

interface SignupModalProps {
  trigger?: React.ReactNode
  defaultSelection?: 'patient' | 'provider'
}

export function SignupModal({ trigger, defaultSelection }: SignupModalProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [hoveredCard, setHoveredCard] = useState<'patient' | 'provider' | null>(defaultSelection || null)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="group">
            Sign Up
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="p-8 pb-0">
          <DialogTitle className="text-2xl font-headline">
            How would you like to use Monobase?
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            Choose your account type to get started with professional healthcare services
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid md:grid-cols-2 gap-8 p-8">
          {/* Patient Card */}
          <Link 
            href={patientSignupUrl}
            className="block"
            onMouseEnter={() => setHoveredCard('patient')}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <Card className={`h-full flex flex-col cursor-pointer transition-all hover:shadow-xl ${
              hoveredCard === 'patient' ? 'ring-2 ring-primary shadow-xl scale-[1.02]' : ''
            }`}>
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-xl font-headline">I'm a Patient</CardTitle>
                <CardDescription className="text-sm mt-2">
                  Get professional healthcare from home
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 flex flex-col flex-1">
                <div className="space-y-3 flex-1">
                  <div className="flex items-start space-x-3">
                    <Video className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-600">Video consultations with licensed providers</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <PillIcon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-600">Expert medication reviews and management</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <CreditCard className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-600">Simple $45 per consultation</p>
                  </div>
                </div>
                
                <Button className="w-full mt-6" variant={hoveredCard === 'patient' ? 'default' : 'outline'}>
                  Sign up as Patient
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </Link>

          {/* Provider Card */}
          <Link
            href={providerSignupUrl}
            className="block"
            onMouseEnter={() => setHoveredCard('provider')}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <Card className={`h-full flex flex-col cursor-pointer transition-all hover:shadow-xl ${
              hoveredCard === 'provider' ? 'ring-2 ring-primary shadow-xl scale-[1.02]' : ''
            }`}>
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4">
                  <Stethoscope className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-xl font-headline">I'm a Provider</CardTitle>
                <CardDescription className="text-sm mt-2">
                  Provide professional healthcare services online
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 flex flex-col flex-1">
                <div className="space-y-3 flex-1">
                  <div className="flex items-start space-x-3">
                    <Video className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-600">Conduct professional video consultations</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Clock className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-600">Set your own schedule and rates</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Shield className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-600">HIPAA-compliant secure platform</p>
                  </div>
                </div>
                
                <Button className="w-full mt-6" variant={hoveredCard === 'provider' ? 'default' : 'outline'}>
                  Sign up as Provider
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}