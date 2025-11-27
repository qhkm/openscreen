'use client'

import React from 'react'
import { Video, Twitter, Github, Linkedin } from 'lucide-react'

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-950 border-t border-slate-900 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                <Video className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl text-white">GoScreen</span>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed">
              Making screen recordings beautiful, automatically. Built for creators, developers, and product teams.
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Features</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Changelog</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Download</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Resources</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Documentation</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Community</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Help Center</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Terms of Service</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-900 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-600 text-sm">
            © {new Date().getFullYear()} GoScreen App. All rights reserved.
          </p>
          <div className="flex space-x-6">
            <a href="#" className="text-slate-500 hover:text-white transition-colors">
              <Twitter className="w-5 h-5" />
            </a>
            <a href="#" className="text-slate-500 hover:text-white transition-colors">
              <Github className="w-5 h-5" />
            </a>
            <a href="#" className="text-slate-500 hover:text-white transition-colors">
              <Linkedin className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
