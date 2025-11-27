'use client'

import React, { useState, useEffect } from 'react'
import { Menu, X, Video } from 'lucide-react'
import { Button } from './ui/Button'

export const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 bg-transparent"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Video className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">GoScreen</span>
          </div>

          {/* Desktop Links */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-8">
              <a href="#features" className="text-slate-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">Features</a>
              <a href="#how-it-works" className="text-slate-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">How it Works</a>
              <a href="#pricing" className="text-slate-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">Pricing</a>
              <a href="#blog" className="text-slate-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">Blog</a>
            </div>
          </div>

          {/* CTA */}
          <div className="hidden md:block">
            <Button variant="primary" size="sm">Download Beta</Button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none"
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <a href="#features" className="text-slate-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium">Features</a>
            <a href="#pricing" className="text-slate-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium">Pricing</a>
            <a href="#blog" className="text-slate-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium">Blog</a>
            <div className="pt-4">
              <Button className="w-full" variant="primary">Download Beta</Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
