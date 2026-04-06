'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowRight, User, LogOut } from 'lucide-react'
import { Button } from '@monobase/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@monobase/ui/components/dropdown-menu'
import { SignupModal } from '@/components/auth/signup-modal'
import { patientAppUrl, providerAppUrl } from '@/utils/config'

interface SiteHeaderProps {
  session: any | null | undefined
  isLoading: boolean
  onSignOut: () => Promise<void>
}

export function SiteHeader({ session, isLoading, onSignOut }: SiteHeaderProps): React.JSX.Element {
  const getDashboardUrl = () => {
    const userRole = (session?.user as any)?.role
    if (!userRole) return `${patientAppUrl}/dashboard`

    const roles = userRole.split(',').map((r: string) => r.trim())

    // If user has provider role, redirect to provider app
    if (roles.includes('provider')) {
      return `${providerAppUrl}/dashboard`
    }

    // Default to patient app
    return `${patientAppUrl}/dashboard`
  }

  return (
    <motion.header 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/">
              <Image
                src="/images/logos/logo-horizontal.svg"
                alt="Monobase Healthcare"
                width={160}
                height={40}
                className="h-10 w-auto"
                priority
              />
            </Link>
          </div>
        </div>
      </div>
    </motion.header>
  )
}
