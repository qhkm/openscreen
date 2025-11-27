'use client'

import React from 'react'
import { Star } from 'lucide-react'
import Image from 'next/image'

interface Testimonial {
  name: string
  role: string
  company: string
  avatar: string
  content: string
}

const testimonials: Testimonial[] = [
  {
    name: "Sarah Jenkins",
    role: "Product Designer",
    company: "Linear",
    avatar: "https://picsum.photos/seed/sarah/100/100",
    content: "GoScreen completely changed how we do changelogs. It used to take me 4 hours to edit a 30s clip. Now it takes 5 minutes."
  },
  {
    name: "Mark Chen",
    role: "Indie Hacker",
    company: "SaaS Kit",
    avatar: "https://picsum.photos/seed/mark/100/100",
    content: "The smooth cursor feature is magic. It makes even my shaky mouse movements look professional."
  },
  {
    name: "Alex Rivera",
    role: "Marketing Lead",
    company: "Vercel",
    avatar: "https://picsum.photos/seed/alex/100/100",
    content: "Finally, a screen recorder that understands aesthetics. The auto-zoom on click is exactly what I needed."
  }
]

export const Testimonials: React.FC = () => {
  return (
    <section className="py-20 bg-slate-900/50 border-y border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-3xl font-extrabold text-white mb-12">
          Loved by product teams
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((t, idx) => (
            <div key={idx} className="bg-slate-950 p-6 rounded-xl border border-slate-800 shadow-sm relative">
               <div className="flex gap-1 mb-4">
                 {[1,2,3,4,5].map(s => <Star key={s} className="w-4 h-4 text-yellow-500 fill-current" />)}
               </div>
               <p className="text-slate-300 mb-6 leading-relaxed">&quot;{t.content}&quot;</p>
               <div className="flex items-center gap-3">
                 <Image src={t.avatar} alt={t.name} width={40} height={40} className="rounded-full border border-slate-700" />
                 <div>
                   <div className="text-white font-medium text-sm">{t.name}</div>
                   <div className="text-slate-500 text-xs">{t.role} @ {t.company}</div>
                 </div>
               </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
