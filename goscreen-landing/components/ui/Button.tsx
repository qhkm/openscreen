'use client'

import React from 'react'
import { ArrowRight } from 'lucide-react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  withArrow?: boolean
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  withArrow = false,
  className = '',
  ...props
}) => {
  const baseStyles = "inline-flex items-center justify-center font-medium transition-all duration-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"

  const variants = {
    primary: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 focus:ring-emerald-500 border border-transparent",
    secondary: "bg-white text-slate-900 hover:bg-slate-100 focus:ring-white border border-transparent",
    outline: "border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white bg-transparent focus:ring-slate-500",
    ghost: "text-slate-400 hover:text-white hover:bg-slate-800/50 focus:ring-slate-500",
  }

  const sizes = {
    sm: "text-sm px-3 py-1.5",
    md: "text-sm px-5 py-2.5",
    lg: "text-base px-6 py-3.5",
  }

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
      {withArrow && <ArrowRight className="ml-2 h-4 w-4" />}
    </button>
  )
}
