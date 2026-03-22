import React from 'react';

function Footer() {
  return (
    <footer className="mt-8 md:mt-12 bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-12">

        {/* Top row — logo left, nav links right */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8">

          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-900 font-bold text-sm">
              B
            </div>
            <span className="text-xl font-extrabold tracking-tight text-white">
              BusinessRun
            </span>
          </div>

          {/* Footer nav links */}
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-sm font-medium text-slate-400">
            <a href="#stories"   className="hover:text-white transition">Stories</a>
            <a href="#tools"     className="hover:text-white transition">Tools</a>
            <a href="#resources" className="hover:text-white transition">Resources</a>
          </div>
        </div>

        {/* Divider + copyright */}
        <div className="border-t border-slate-700 pt-6 text-center">
          <p className="text-slate-500 text-xs sm:text-sm">
            © 2025 BusinessRun Platform. All Rights Reserved.
          </p>
        </div>

      </div>
    </footer>
  );
}

export default Footer;
