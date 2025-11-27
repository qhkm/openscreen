'use client'

import { Navbar } from '@/components/Navbar'
import { Hero } from '@/components/Hero'
import { Features } from '@/components/Features'
import { Pricing } from '@/components/Pricing'
import { Testimonials } from '@/components/Testimonials'
import { Footer } from '@/components/Footer'

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-emerald-500/30">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Testimonials />
        <Pricing />

        {/* Pre-footer CTA */}
        <section className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-emerald-900/10"></div>
          <div className="max-w-4xl mx-auto px-4 relative z-10 text-center">
             <h2 className="text-4xl font-bold text-white mb-6">Ready to level up your demos?</h2>
             <p className="text-xl text-slate-400 mb-8">Join 10,000+ creators making better videos with GoScreen.</p>
             <button className="bg-white text-emerald-600 hover:bg-slate-100 font-bold py-3 px-8 rounded-lg shadow-lg transform transition hover:scale-105 duration-200">
               Get Started for Free
             </button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
