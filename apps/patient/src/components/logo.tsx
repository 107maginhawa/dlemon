import { cn } from '@monobase/ui/lib/utils'
import { useTheme } from "next-themes"

interface LogoProps {
  variant?: 'horizontal' | 'vertical'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export function Logo({
  variant = 'horizontal',
  size = 'md',
  className
}: LogoProps) {
  const { theme } = useTheme()

  const sizeClasses = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-10',
    xl: 'h-12'
  }

  // Use white logo for dark theme, regular for light theme
  const logoSrc = theme === 'dark'
    ? '/images/logos/logo-horizontal-white.svg'
    : '/images/logos/logo-horizontal.svg'

  return (
    <img
      src={logoSrc}
      alt="Monobase"
      className={cn(
        'object-contain',
        sizeClasses[size],
        className
      )}
    />
  )
}
