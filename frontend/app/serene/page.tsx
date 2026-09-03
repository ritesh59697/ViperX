"use client";

import { Dancing_Script, Instrument_Serif, Inter } from "next/font/google";
import { useEffect, useRef, useState } from "react";

// Google Fonts integrations matching Next.js specifications
const dancingScript = Dancing_Script({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-serene-logo",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-serene-serif",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-serene-sans",
});

export default function SerenePage() {
  const [isMuted, setIsMuted] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Parallax animation refs
  const quoteSectionRef = useRef<HTMLDivElement>(null);
  const rainbowRef = useRef<HTMLDivElement>(null);
  const leftCloudRef = useRef<HTMLDivElement>(null);
  const rightCloudRef = useRef<HTMLDivElement>(null);

  // Mute toggle handler
  const handleToggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  useEffect(() => {
    const quoteSection = quoteSectionRef.current;
    if (!quoteSection) return;

    // Lerp values tracking
    let currentRainbowY = 120;
    let targetRainbowY = 120;

    let currentLeftCloudX = -200;
    let targetLeftCloudX = -200;
    let currentLeftCloudY = 0;
    let targetLeftCloudY = 0;

    let currentRightCloudX = 200;
    let targetRightCloudX = 200;
    let currentRightCloudY = 0;
    let targetRightCloudY = 0;

    let animationFrameId = 0;
    let disposed = false;

    const updateParallax = () => {
      if (disposed) return;
      const rect = quoteSection.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      // Calculate progress (0 to 1) based on how far section has scrolled through the viewport
      const progress = Math.max(
        0,
        Math.min(1, (windowHeight - rect.top) / (windowHeight + rect.height))
      );

      // Target calculations
      targetRainbowY = 120 + progress * (-160 - 120);

      if (progress > 0.12 && progress < 0.92) {
        targetLeftCloudX = 0;
        targetRightCloudX = 0;
      } else {
        targetLeftCloudX = -200;
        targetRightCloudX = 200;
      }
      
      targetLeftCloudY = progress * -50;
      targetRightCloudY = progress * -50;

      // Lerp interpolations
      currentRainbowY += (targetRainbowY - currentRainbowY) * 0.06;
      currentLeftCloudX += (targetLeftCloudX - currentLeftCloudX) * 0.04;
      currentLeftCloudY += (targetLeftCloudY - currentLeftCloudY) * 0.04;
      
      currentRightCloudX += (targetRightCloudX - currentRightCloudX) * 0.04;
      currentRightCloudY += (targetRightCloudY - currentRightCloudY) * 0.04;

      // Render translations via requestAnimationFrame GPU-acceleration
      if (rainbowRef.current) {
        rainbowRef.current.style.transform = `translate3d(0, ${currentRainbowY}px, 0)`;
      }
      if (leftCloudRef.current) {
        const opacity = Math.max(0, Math.min(1, 1 - Math.abs(currentLeftCloudX) / 200));
        leftCloudRef.current.style.transform = `translate3d(${currentLeftCloudX}px, ${currentLeftCloudY}px, 0)`;
        leftCloudRef.current.style.opacity = `${opacity}`;
      }
      if (rightCloudRef.current) {
        const opacity = Math.max(0, Math.min(1, 1 - Math.abs(currentRightCloudX) / 200));
        rightCloudRef.current.style.transform = `translate3d(${currentRightCloudX}px, ${currentRightCloudY}px, 0) scaleX(-1)`;
        rightCloudRef.current.style.opacity = `${opacity}`;
      }

      animationFrameId = requestAnimationFrame(updateParallax);
    };

    updateParallax();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      className={`${dancingScript.variable} ${instrumentSerif.variable} ${inter.variable} font-serene-sans bg-[#0a0608] min-h-screen text-white overflow-x-hidden`}
    >
      {/* --- SECTION 1: HERO --- */}
      <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
        {/* Background video */}
        <video
          ref={videoRef}
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260613_180732_a54afbf6-b30d-470e-861f-669871f09f67.mp4"
          muted={isMuted}
          loop
          playsInline
          autoPlay
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/20" />

        {/* Fixed Navbar */}
        <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-5 bg-gradient-to-b from-black/40 to-transparent">
          {/* Brand Logo */}
          <div className="font-serene-logo text-2xl md:text-3xl text-white font-semibold">
            Serene
          </div>

          {/* Center Navigation Links (Desktop) */}
          <div className="hidden md:flex items-center gap-12">
            <a href="#about" className="text-white/80 hover:text-white text-sm tracking-wide transition-colors font-medium">About</a>
            <a href="#services" className="text-white/80 hover:text-white text-sm tracking-wide transition-colors font-medium">Services</a>
            <a href="#journal" className="text-white/80 hover:text-white text-sm tracking-wide transition-colors font-medium">Journal</a>
            <a href="#contact" className="text-white/80 hover:text-white text-sm tracking-wide transition-colors font-medium">Contact</a>
          </div>

          {/* Right Button (Desktop) */}
          <div className="hidden md:block">
            <button className="bg-white text-black px-8 py-3.5 rounded-full font-medium text-sm tracking-wide hover:bg-white/90 transition-all duration-300 button-glow">
              Book a consultation
            </button>
          </div>

          {/* Right Hamburger Icon (Mobile) */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="block md:hidden relative z-50 w-6 h-5 focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            <div className="relative w-full h-full flex flex-col justify-between">
              <span
                className={`w-full h-0.5 bg-white rounded-full transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isMobileMenuOpen ? "rotate-45 translate-y-[9px]" : ""
                }`}
              />
              <span
                className={`w-full h-0.5 bg-white rounded-full transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isMobileMenuOpen ? "scale-0 opacity-0" : ""
                }`}
              />
              <span
                className={`w-full h-0.5 bg-white rounded-full transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isMobileMenuOpen ? "-rotate-45 -translate-y-[9px]" : ""
                }`}
              />
            </div>
          </button>
        </nav>

        {/* Mobile menu panel */}
        <div
          className={`fixed top-0 right-0 bottom-0 z-40 w-[85%] max-w-[340px] bg-[#0a0608]/95 backdrop-blur-xl border-l border-white/10 px-8 pt-28 pb-8 flex flex-col justify-between transform transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex flex-col gap-8">
            <a
              href="#about"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-white/90 hover:text-white text-xl tracking-wide font-medium transition-all duration-300"
              style={{
                transitionDelay: isMobileMenuOpen ? "150ms" : "0ms",
                transform: isMobileMenuOpen ? "translateX(0)" : "translateX(20px)",
                opacity: isMobileMenuOpen ? 1 : 0,
              }}
            >
              About
            </a>
            <a
              href="#services"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-white/90 hover:text-white text-xl tracking-wide font-medium transition-all duration-300"
              style={{
                transitionDelay: isMobileMenuOpen ? "225ms" : "0ms",
                transform: isMobileMenuOpen ? "translateX(0)" : "translateX(20px)",
                opacity: isMobileMenuOpen ? 1 : 0,
              }}
            >
              Services
            </a>
            <a
              href="#journal"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-white/90 hover:text-white text-xl tracking-wide font-medium transition-all duration-300"
              style={{
                transitionDelay: isMobileMenuOpen ? "300ms" : "0ms",
                transform: isMobileMenuOpen ? "translateX(0)" : "translateX(20px)",
                opacity: isMobileMenuOpen ? 1 : 0,
              }}
            >
              Journal
            </a>
            <a
              href="#contact"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-white/90 hover:text-white text-xl tracking-wide font-medium transition-all duration-300"
              style={{
                transitionDelay: isMobileMenuOpen ? "375ms" : "0ms",
                transform: isMobileMenuOpen ? "translateX(0)" : "translateX(20px)",
                opacity: isMobileMenuOpen ? 1 : 0,
              }}
            >
              Contact
            </a>
          </div>

          <button
            className="w-full bg-white text-black py-4 rounded-full font-medium text-sm tracking-wide hover:bg-white/90 transition-all duration-300 button-glow"
            style={{
              transitionDelay: isMobileMenuOpen ? "450ms" : "0ms",
              transform: isMobileMenuOpen ? "translateY(0)" : "translateY(15px)",
              opacity: isMobileMenuOpen ? 1 : 0,
            }}
          >
            Book a consultation
          </button>
        </div>

        {/* Hero Center Content */}
        <div className="relative z-10 flex flex-col items-center px-6 -mt-[120px]">
          <h2 className="font-serene-serif text-white text-[36px] md:text-7xl lg:text-[110px] leading-[0.9] tracking-tight text-center text-glow select-none">
            Gentle touch.<br />Radiant presence.
          </h2>
          <p className="text-white/70 text-sm md:text-base text-center mt-5 md:mt-7 max-w-xl leading-relaxed">
            Expert beauty and holistic wellness, delivered with warmth and intention.
          </p>
          <button className="bg-white text-black px-8 py-3.5 rounded-full font-medium text-sm tracking-wide hover:bg-white/90 transition-all duration-300 button-glow mt-6 md:mt-9">
            Begin your renewal
          </button>
        </div>

        {/* Sound Indicator (Desktop Only) */}
        <div className="hidden md:flex items-center gap-3 absolute bottom-8 left-8 z-10">
          <button
            onClick={handleToggleMute}
            className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors"
            aria-label={isMuted ? "Unmute sound" : "Mute sound"}
          >
            <div className="flex items-end gap-0.5 h-3">
              <span className={`w-0.5 bg-white transition-all duration-300 ${isMuted ? "h-1" : "h-3 animate-pulse"}`} />
              <span className={`w-0.5 bg-white transition-all duration-300 ${isMuted ? "h-1" : "h-2 animate-pulse"}`} style={{ animationDelay: "150ms" }} />
              <span className={`w-0.5 bg-white transition-all duration-300 ${isMuted ? "h-1" : "h-3 animate-pulse"}`} style={{ animationDelay: "300ms" }} />
            </div>
          </button>
          <div className="text-white/60 text-xs leading-tight">
            <div>Experience</div>
            <div>with sound</div>
          </div>
        </div>
      </section>

      {/* --- SECTION 2: QUOTE SECTION --- */}
      <section
        ref={quoteSectionRef}
        className="relative h-screen w-full flex items-center justify-center overflow-hidden px-6 md:px-12"
        style={{
          background: "linear-gradient(to bottom, #010A17 0%, #0A4267 30%, #20658E 60%, #6BADC4 100%)",
        }}
      >
        {/* Layer 1: Rainbow Image */}
        <div
          ref={rainbowRef}
          className="absolute inset-x-0 top-0 z-30 pointer-events-none h-48 w-full bg-cover bg-center will-change-transform"
          style={{
            backgroundImage: "url('https://soft-zoom-63098134.figma.site/_assets/v11/8d520a7515d06cbfc403d0125e3d05b1a7ccd29c.png')",
          }}
        />

        {/* Layer 2: Left Cloud (Desktop only) */}
        <div
          ref={leftCloudRef}
          className="hidden sm:block absolute left-0 bottom-[10%] z-10 w-[500px] md:w-[650px] -ml-[50%] pointer-events-none opacity-0 will-change-transform"
        >
          <img
            src="https://soft-zoom-63098134.figma.site/_assets/v11/0d6dfd3f90b930f21726f2ed56a3320d79b7a797.png"
            alt="Soft drift cloud decoration left"
            className="w-full h-auto object-contain"
          />
        </div>

        {/* Layer 3: Right Cloud (Flipped, Desktop only) */}
        <div
          ref={rightCloudRef}
          className="hidden sm:block absolute right-0 bottom-[15%] z-10 w-[500px] md:w-[650px] -mr-[75%] pointer-events-none opacity-0 will-change-transform"
        >
          <img
            src="https://soft-zoom-63098134.figma.site/_assets/v11/0d6dfd3f90b930f21726f2ed56a3320d79b7a797.png"
            alt="Soft drift cloud decoration right"
            className="w-full h-auto object-contain"
          />
        </div>

        {/* Layer 4: Quote Content */}
        <div className="relative z-20 max-w-4xl text-center flex flex-col items-center">
          <p className="font-serene-serif text-white text-xl sm:text-2xl md:text-4xl lg:text-[42px] leading-[1.45] md:leading-[1.5] select-none italic">
            &ldquo;Serene was founded on a belief in beauty that honors your nature. We pursue refined outcomes, considered approaches, and lasting vitality. We spend time learning what matters to you before deciding what serves you best. No rushing, no excess &mdash; just support that lets you feel radiant.&rdquo;
          </p>
          <span className="mt-6 md:mt-8 text-white/80 text-sm md:text-base tracking-widest font-mono uppercase">
            Dr. Mia Callahan &mdash; Founder
          </span>
        </div>
      </section>
    </div>
  );
}
