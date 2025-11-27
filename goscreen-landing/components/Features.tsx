'use client'

import React from 'react'
import { MousePointer2, ZoomIn, Layers, Smartphone, Wand2 } from 'lucide-react'

interface Feature {
  title: string
  description: string
  icon: React.ReactNode
  colSpan?: number
}

const featureList: Feature[] = [
  {
    title: "Smooth Cursor",
    description: "Jittery mouse movements are automatically smoothed out for a polished look.",
    icon: <MousePointer2 className="w-6 h-6 text-emerald-400" />,
    colSpan: 2
  },
  {
    title: "Auto Zoom",
    description: "GoScreen detects where you click and automatically zooms in to focus on the action.",
    icon: <ZoomIn className="w-6 h-6 text-teal-400" />,
    colSpan: 1
  },
  {
    title: "Beautiful Backgrounds",
    description: "Add padding and professional wallpapers to your recordings instantly.",
    icon: <Layers className="w-6 h-6 text-cyan-400" />,
    colSpan: 1
  },
  {
    title: "Mobile Mockups",
    description: "Wrap your mobile recordings in realistic device frames.",
    icon: <Smartphone className="w-6 h-6 text-sky-400" />,
    colSpan: 2
  },
  {
    title: "AI Editing",
    description: "Remove silence and filler words with one click.",
    icon: <Wand2 className="w-6 h-6 text-lime-400" />,
    colSpan: 3
  }
]

export const Features: React.FC = () => {
  return (
    <section id="features" className="py-20 bg-slate-950 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-base text-emerald-400 font-semibold tracking-wide uppercase">Features</h2>
          <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-white sm:text-4xl">
            Everything you need for viral demos
          </p>
          <p className="mt-4 max-w-2xl text-xl text-slate-400 mx-auto">
            Stop wasting hours in After Effects. GoScreen automates the tedious parts of editing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-fr">
          {featureList.map((feature, index) => (
            <div
              key={index}
              className={`
                relative p-8 rounded-2xl bg-slate-900 border border-slate-800
                hover:border-slate-700 transition-all duration-300 group
                ${feature.colSpan === 2 ? 'md:col-span-2' : ''}
                ${feature.colSpan === 3 ? 'md:col-span-3' : ''}
              `}
            >
              <div className="bg-slate-800/50 w-12 h-12 rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
              <p className="text-slate-400 leading-relaxed">
                {feature.description}
              </p>

              {/* Decorative gradient for hover effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
