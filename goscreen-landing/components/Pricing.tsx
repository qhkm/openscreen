'use client'

import React from 'react'
import { Check } from 'lucide-react'
import { Button } from './ui/Button'

interface PricingTier {
  name: string
  price: string
  description: string
  features: string[]
  cta: string
  popular?: boolean
}

const tiers: PricingTier[] = [
  {
    name: "Starter",
    price: "$0",
    description: "Perfect for quick demos and personal use.",
    features: [
      "720p Export Quality",
      "Standard Backgrounds",
      "Manual Zoom",
      "Watermark"
    ],
    cta: "Start for Free"
  },
  {
    name: "Pro",
    price: "$15",
    description: "For creators who want the best quality.",
    popular: true,
    features: [
      "4K Export Quality",
      "Auto Zoom & Smooth Cursor",
      "Custom Backgrounds",
      "No Watermark",
      "Priority Support"
    ],
    cta: "Get Pro"
  },
  {
    name: "Team",
    price: "$49",
    description: "Collaborate on videos with your team.",
    features: [
      "Everything in Pro",
      "Shared Library",
      "Team Branding Assets",
      "Admin Controls",
      "SSO"
    ],
    cta: "Contact Sales"
  }
]

export const Pricing: React.FC = () => {
  return (
    <section id="pricing" className="py-24 bg-slate-950 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-900/20 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            Simple pricing for everyone
          </h2>
          <p className="mt-4 text-xl text-slate-400">
            Start for free, upgrade when you go viral.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {tiers.map((tier, idx) => (
            <div
              key={idx}
              className={`
                relative flex flex-col p-8 rounded-2xl border
                ${tier.popular
                  ? 'bg-slate-900/80 border-emerald-500 shadow-2xl shadow-emerald-500/20 scale-105 z-10'
                  : 'bg-slate-900/40 border-slate-800'
                }
              `}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold rounded-full uppercase tracking-wide">
                  Most Popular
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-lg font-medium text-white">{tier.name}</h3>
                <div className="mt-4 flex items-baseline">
                  <span className="text-4xl font-extrabold text-white">{tier.price}</span>
                  {tier.price !== 'Custom' && <span className="ml-2 text-slate-500">/month</span>}
                </div>
                <p className="mt-4 text-sm text-slate-400">{tier.description}</p>
              </div>

              <ul className="space-y-4 mb-8 flex-1">
                {tier.features.map((feature, fIdx) => (
                  <li key={fIdx} className="flex items-start">
                    <Check className="flex-shrink-0 w-5 h-5 text-emerald-400" />
                    <span className="ml-3 text-sm text-slate-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={tier.popular ? 'primary' : 'outline'}
                className="w-full"
              >
                {tier.cta}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
