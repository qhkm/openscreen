'use client'

import React from 'react'
import { Button } from './ui/Button'
import { Play, Video, Monitor } from 'lucide-react'
import { motion } from 'framer-motion'

export const Hero: React.FC = () => {
  return (
    <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">

      {/* Background Blobs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full z-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-600/20 rounded-full blur-3xl animate-blob mix-blend-screen"></div>
        <div className="absolute top-20 right-10 w-72 h-72 bg-teal-600/20 rounded-full blur-3xl animate-blob animation-delay-2000 mix-blend-screen"></div>
        <div className="absolute -bottom-32 left-1/2 w-72 h-72 bg-cyan-600/20 rounded-full blur-3xl animate-blob animation-delay-4000 mix-blend-screen"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20 text-center">
        {/* App Icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-16 h-16 rounded-2xl shadow-lg overflow-hidden mb-8 ring-1 ring-white/20 bg-emerald-600 backdrop-blur-md flex items-center justify-center mx-auto"
        >
          <Video className="w-8 h-8 text-white" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.1] text-white mb-6"
        >
          Screen recording, <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
            reimagined.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-4 max-w-2xl mx-auto text-xl text-slate-400 mb-10"
        >
          Create studio-quality product updates, tutorials, and demos in minutes.
          Automatic zoom, smooth cursor movement, and beautiful backgrounds.
          <span className="text-slate-200"> No editing skills required.</span>
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
        >
          <button
            className="px-8 py-4 bg-emerald-600 rounded-full text-white font-medium text-lg hover:bg-emerald-500 transition-all shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)] active:scale-95 hover:shadow-[0_0_60px_-10px_rgba(16,185,129,0.6)]"
          >
            Download for Free
          </button>
          <Button size="lg" variant="outline" className="group rounded-full">
            <Play className="mr-2 h-4 w-4 fill-current group-hover:text-emerald-400 transition-colors" />
            Watch Demo
          </Button>
        </motion.div>

        {/* Hero Visual/Dashboard Mockup */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="relative max-w-5xl mx-auto"
        >
          <div className="relative rounded-xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden aspect-video group">
            <div className="absolute top-0 w-full h-8 bg-slate-800/50 flex items-center px-4 gap-2 border-b border-slate-700">
              <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
            </div>
            {/* Simulation of the UI */}
            <div className="p-8 mt-4 h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
                <div className="bg-emerald-500/10 p-12 rounded-full mb-4">
                  <Monitor className="w-16 h-16 text-emerald-500" />
                </div>
                <div className="text-slate-500 font-mono text-sm">Recording in progress...</div>

                {/* Floating Elements for visual interest */}
                <div className="absolute top-1/2 left-1/4 -translate-y-1/2 p-4 bg-slate-800 rounded-lg border border-slate-700 shadow-xl transform -rotate-6 transition-transform group-hover:rotate-0 duration-500">
                   <div className="w-32 h-2 bg-slate-600 rounded mb-2"></div>
                   <div className="w-24 h-2 bg-slate-700 rounded"></div>
                </div>

                <div className="absolute bottom-10 right-10 p-4 bg-slate-800/80 backdrop-blur rounded-lg border border-slate-700 shadow-xl flex items-center gap-3">
                   <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                   <span className="text-xs font-medium text-white">00:42</span>
                </div>
            </div>
          </div>

          {/* Decorative Glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl blur opacity-20 -z-10 transition duration-1000 group-hover:opacity-40"></div>
        </motion.div>

        <div className="mt-16 pt-8 border-t border-slate-800/50">
          <p className="text-sm text-slate-500 mb-6 font-medium">TRUSTED BY TEAMS AT</p>
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
             <span className="text-xl font-bold text-white">ACME</span>
             <span className="text-xl font-bold text-white">Stark</span>
             <span className="text-xl font-bold text-white">Wayne Ent.</span>
             <span className="text-xl font-bold text-white">Cyberdyne</span>
             <span className="text-xl font-bold text-white">Globex</span>
          </div>
        </div>
      </div>
    </section>
  )
}
