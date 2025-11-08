import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  MessageSquare,
  Users,
  Zap,
  Shield,
  BarChart3,
  Bot,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Clock,
  Globe,
  Star,
  X,
  Check,
  ChevronDown,
  TrendingUp,
  Smartphone,
  Mail,
  Phone,
  MapPin
} from "lucide-react";
import AOS from 'aos';
import 'aos/dist/aos.css';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";

const Landing = () => {
  const navigate = useNavigate();
  const [isReady, setIsReady] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [parallaxOffset, setParallaxOffset] = useState(0);

  // Dynamic content from database
  const [aboutData, setAboutData] = useState({ title: '', content: '' });
  const [featuresData, setFeaturesData] = useState<any[]>([]);
  const [contactData, setContactData] = useState({ email: '', phone: '', address: '' });
  const [plansData, setPlansData] = useState<any[]>([]);

  useEffect(() => {
    AOS.init({
      duration: 800,
      easing: 'ease-in-out',
      once: true,
      offset: 100,
      delay: 0,
    });
    setIsReady(true);
    fetchLandingContent();
  }, []);

  // Scroll Progress Bar & Parallax Effect
  useEffect(() => {
    const handleScroll = () => {
      // Calculate scroll progress (0 to 100)
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY;
      const scrollPercent = (scrollTop / (documentHeight - windowHeight)) * 100;
      setScrollProgress(scrollPercent);

      // Calculate parallax offset (smoother scrolling for background)
      setParallaxOffset(scrollTop * 0.5);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


  const fetchLandingContent = async () => {
    try {
      // Fetch About section
      const { data: aboutSection } = await supabase
        .from('landing_sections')
        .select('*')
        .eq('section_key', 'about')
        .single();

      if (aboutSection) {
        setAboutData({ title: aboutSection.title, content: aboutSection.content });
      }

      // Fetch Features
      const { data: features } = await supabase
        .from('landing_features')
        .select('*')
        .order('order_index');

      if (features) {
        setFeaturesData(features);
      }

      // Fetch Contact
      const { data: contact } = await supabase
        .from('landing_contact')
        .select('*')
        .single();

      if (contact) {
        setContactData({
          email: contact.email || '',
          phone: contact.phone || '',
          address: contact.address || ''
        });
      }

      // Fetch Plans
      const { data: plans } = await supabase
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('price');

      if (plans) {
        setPlansData(plans);
      }
    } catch (error) {
      console.error('Error fetching landing content:', error);
    }
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Icon mapping function
  const getIcon = (iconName: string) => {
    const iconMap: Record<string, any> = {
      MessageSquare: <MessageSquare className="w-6 h-6" />,
      Users: <Users className="w-6 h-6" />,
      Bot: <Bot className="w-6 h-6" />,
      Zap: <Zap className="w-6 h-6" />,
      Shield: <Shield className="w-6 h-6" />,
      BarChart3: <BarChart3 className="w-6 h-6" />,
      Star: <Star className="w-6 h-6" />,
      CheckCircle2: <CheckCircle2 className="w-6 h-6" />,
    };
    return iconMap[iconName] || <Star className="w-6 h-6" />;
  };

  const features = [
    {
      icon: <MessageSquare className="w-6 h-6" />,
      title: "Multi-Device Management",
      description: "Kelola multiple WhatsApp devices dalam satu platform terpadu"
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Broadcast Messages",
      description: "Kirim pesan broadcast ke ribuan kontak secara otomatis"
    },
    {
      icon: <Bot className="w-6 h-6" />,
      title: "Chatbot Automation",
      description: "Automasi percakapan dengan chatbot AI yang cerdas"
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Quick Setup",
      description: "Aktivasi device hanya dalam 5 menit dengan QR Code"
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Secure & Reliable",
      description: "Platform aman dengan enkripsi end-to-end"
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Analytics Dashboard",
      description: "Monitor performa campaign dengan real-time analytics"
    }
  ];

  const benefits = [
    "API Integration untuk developer",
    "Scheduled Messages & Auto Post",
    "Contact Management System",
    "Template Message Library",
    "Webhook Integration",
    "24/7 Customer Support"
  ];

  const testimonials = [
    {
      name: "Budi Santoso",
      role: "Owner, TokoBagus.id",
      avatar: "BS",
      text: "HalloWa mengubah cara saya berbisnis! Closing rate naik 3x lipat dalam 2 bulan. ROI-nya luar biasa!",
      rating: 5
    },
    {
      name: "Siti Nurhaliza",
      role: "Marketing Manager, Fashion Store",
      avatar: "SN",
      text: "Broadcast otomatis sangat membantu! Saya bisa reach 5000+ customer dalam hitungan menit. Game changer!",
      rating: 5
    },
    {
      name: "Ahmad Hidayat",
      role: "CEO, Digital Agency",
      avatar: "AH",
      text: "Platform terbaik untuk manage client WhatsApp. Team saya jadi lebih produktif dan client lebih puas.",
      rating: 5
    }
  ];

  const comparison = [
    { feature: "Kecepatan Broadcast", manual: "10 pesan/jam", hallowa: "1000+ pesan/jam" },
    { feature: "Automasi Chat", manual: "Manual semua", hallowa: "AI Chatbot 24/7" },
    { feature: "Analytics", manual: "Tidak ada", hallowa: "Real-time dashboard" },
    { feature: "Multi-Device", manual: "1 device saja", hallowa: "Unlimited devices" },
    { feature: "Customer Support", manual: "-", hallowa: "24/7 Support" },
  ];

  const faqs = [
    {
      question: "Apakah data saya aman di HalloWa?",
      answer: "Sangat aman! Kami menggunakan enkripsi end-to-end dan server yang comply dengan standar internasional. Data Anda 100% terlindungi."
    },
    {
      question: "Berapa banyak device yang bisa saya kelola?",
      answer: "Tergantung paket yang Anda pilih. Paket Basic: 3 devices, Pro: 10 devices, Enterprise: Unlimited devices."
    },
    {
      question: "Apakah ada free trial?",
      answer: "Ya! Kami menyediakan free trial 7 hari dengan akses penuh ke semua fitur. Tidak perlu kartu kredit untuk memulai."
    },
    {
      question: "Bagaimana cara setup device baru?",
      answer: "Sangat mudah! Cukup scan QR code dari dashboard, dan device Anda langsung terhubung dalam 30 detik. Ada video tutorial lengkap juga."
    },
    {
      question: "Apakah bisa kirim media (gambar, video, dokumen)?",
      answer: "Tentu saja! HalloWa support semua jenis media termasuk gambar, video, dokumen PDF, dan file lainnya dalam broadcast."
    },
    {
      question: "Bagaimana dengan customer support?",
      answer: "Kami menyediakan 24/7 customer support via live chat, email, dan WhatsApp. Response time rata-rata kurang dari 5 menit."
    }
  ];

  if (!isReady) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-green-50/30 to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 overflow-hidden">
      {/* Scroll Progress Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-gray-200 dark:bg-gray-800">
        <div
          className="h-full bg-gradient-to-r from-green-600 via-emerald-500 to-green-600 transition-all duration-150 ease-out shadow-lg shadow-green-500/50"
          style={{
            width: `${scrollProgress}%`,
            boxShadow: scrollProgress > 0 ? '0 0 10px rgba(34, 197, 94, 0.5)' : 'none'
          }}
        />
      </div>

      {/* Custom Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(34, 197, 94, 0.3); }
          50% { box-shadow: 0 0 40px rgba(34, 197, 94, 0.6); }
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float 6s ease-in-out infinite 1s;
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient-shift 8s ease infinite;
        }
        .animate-glow {
          animation: glow 3s ease-in-out infinite;
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.8s ease-out forwards;
        }
        .animate-scale-in {
          animation: scaleIn 0.6s ease-out forwards;
        }
        .card-3d:hover {
          transform: translateY(-10px) scale(1.02);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        .magnetic-button {
          transition: transform 0.2s cubic-bezier(0.23, 1, 0.32, 1);
        }
        .magnetic-button:hover {
          transform: scale(1.05);
        }
        .magnetic-button:active {
          transform: scale(0.98);
        }
        @media (hover: hover) {
          .magnetic-hover:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(34, 197, 94, 0.4);
          }
        }
      `}</style>

      {/* Decorative Background with Animation & Parallax */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div
          className="absolute top-0 right-0 w-[500px] h-[500px] bg-green-500/10 rounded-full blur-3xl animate-float transition-transform duration-100 ease-out"
          style={{ transform: `translateY(${parallaxOffset * 0.3}px)` }}
        />
        <div
          className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-3xl animate-float-delayed transition-transform duration-100 ease-out"
          style={{ transform: `translateY(-${parallaxOffset * 0.4}px)` }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-teal-500/5 rounded-full blur-3xl animate-pulse transition-transform duration-100 ease-out"
          style={{ transform: `translate(-50%, calc(-50% + ${parallaxOffset * 0.2}px))` }}
        />
      </div>

      {/* Hero Section */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex justify-between items-center mb-20" data-aos="fade-down">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">HalloWa</span>
          </div>
          <div className="hidden md:flex gap-6 items-center">
            <button onClick={() => scrollToSection('about')} className="text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 transition-colors">
              Tentang
            </button>
            <button onClick={() => scrollToSection('features')} className="text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 transition-colors">
              Fitur
            </button>
            <button onClick={() => scrollToSection('pricing')} className="text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 transition-colors">
              Harga
            </button>
            <button onClick={() => scrollToSection('contact')} className="text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 transition-colors">
              Kontak
            </button>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => navigate("/auth")} className="hidden sm:flex">
              Login
            </Button>
            <Button onClick={() => navigate("/auth")} className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg shadow-green-500/30">
              Get Started
            </Button>
          </div>
        </nav>

        <div className="grid lg:grid-cols-2 gap-12 items-center mb-20">
          {/* Left Content */}
          <div className="text-left">
            <div 
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded-full mb-6"
              data-aos="fade-up"
            >
              <Sparkles className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">WhatsApp Marketing Solution</span>
            </div>
            
            <h1
              className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 dark:text-white mb-6 leading-tight"
              data-aos="fade-up"
              data-aos-delay="100"
            >
              Automate Your
              <span className="bg-gradient-to-r from-green-600 via-emerald-500 to-green-600 bg-clip-text text-transparent animate-gradient"> WhatsApp </span>
              Marketing
            </h1>
            
            <p 
              className="text-xl text-gray-600 dark:text-gray-300 mb-8 leading-relaxed"
              data-aos="fade-up"
              data-aos-delay="200"
            >
              Platform profesional untuk kelola multiple devices, broadcast messages, dan chatbot automation dalam satu dashboard terpadu
            </p>
            
            <div 
              className="flex flex-col sm:flex-row gap-4"
              data-aos="fade-up"
              data-aos-delay="300"
            >
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-lg px-8 shadow-xl shadow-green-500/30 group animate-glow magnetic-button"
              >
                Mulai Sekarang <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate("/pricing")}
                className="text-lg px-8 border-2"
              >
                Lihat Harga
              </Button>
            </div>

            {/* Stats Counter */}
            <div className="flex flex-wrap gap-8 mt-12" data-aos="fade-up" data-aos-delay="400">
              <StatsCounter value={10000} suffix="+" label="Active Users" />
              <StatsCounter value={50} suffix="M+" label="Messages Sent" />
              <StatsCounter value={99.9} suffix="%" label="Uptime" />
            </div>
          </div>

          {/* Right Content - Chat Animation */}
          <div className="relative animate-float" data-aos="fade-left" data-aos-delay="200">
            <div className="absolute -inset-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-3xl blur-2xl" />
            <div className="relative">
              <ChatAnimation />
            </div>
          </div>
        </div>
      </header>

      {/* Social Proof */}
      <section className="bg-gray-50 dark:bg-gray-800/50 py-12 border-y border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4">
          <p className="text-center text-gray-600 dark:text-gray-400 mb-8 font-medium">
            Dipercaya oleh ribuan bisnis di Indonesia
          </p>
          <div className="flex flex-wrap justify-center items-center gap-12 opacity-50">
            <div className="text-2xl font-bold text-gray-400">TokoBagus</div>
            <div className="text-2xl font-bold text-gray-400">ShopMart</div>
            <div className="text-2xl font-bold text-gray-400">BisnisKu</div>
            <div className="text-2xl font-bold text-gray-400">OnlineStore</div>
          </div>
        </div>
      </section>

      {/* About Section */}
      {aboutData.title && (
        <section id="about" className="container mx-auto px-4 py-24">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12" data-aos="fade-up">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
                <Globe className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">Tentang Kami</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
                {aboutData.title}
              </h2>
            </div>
            <div
              className="prose prose-lg dark:prose-invert max-w-none text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line"
              data-aos="fade-up"
              data-aos-delay="100"
            >
              {aboutData.content}
            </div>
          </div>
        </section>
      )}

      {/* Dashboard Showcase */}
      <section className="container mx-auto px-4 py-24">
        <div className="text-center mb-16" data-aos="fade-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
            <Smartphone className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">Dashboard Preview</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Dashboard yang Powerful & Intuitive
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Monitor semua aktivitas WhatsApp Anda dalam satu dashboard yang mudah digunakan
          </p>
        </div>

        <div
          className="relative transition-transform duration-100 ease-out"
          data-aos="zoom-in"
          style={{ transform: `translateY(${parallaxOffset * 0.15}px)` }}
        >
          <div className="absolute -inset-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-3xl blur-2xl opacity-20" />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
            <img
              src="/dashboard-preview.png"
              alt="HalloWa Dashboard"
              className="w-full h-auto"
            />
            <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              Live Demo
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-24">
        <div className="text-center mb-16" data-aos="fade-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
            <Sparkles className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">Fitur Lengkap</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Semua yang Anda Butuhkan
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Tools lengkap untuk WhatsApp Marketing yang efektif dan terukur
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {(featuresData.length > 0 ? featuresData : features).map((feature, index) => (
            <div
              key={index}
              className="group bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 dark:border-gray-700 hover:border-green-500/50 hover:-translate-y-1"
              data-aos="fade-up"
              data-aos-delay={index * 100}
            >
              <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mb-5 text-white shadow-lg group-hover:scale-110 transition-transform">
                {featuresData.length > 0 ? getIcon(feature.icon) : feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                {feature.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      {plansData.length > 0 && (
        <section id="pricing" className="container mx-auto px-4 py-24 relative overflow-hidden">
          {/* Animated Background with Parallax */}
          <div className="absolute inset-0 -z-10">
            <div
              className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl animate-pulse transition-transform duration-100 ease-out"
              style={{ transform: `translate(${parallaxOffset * 0.1}px, ${parallaxOffset * 0.15}px)` }}
            />
            <div
              className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse transition-transform duration-100 ease-out"
              style={{
                animationDelay: '1s',
                transform: `translate(-${parallaxOffset * 0.12}px, -${parallaxOffset * 0.18}px)`
              }}
            />
          </div>

          <div className="text-center mb-16" data-aos="fade-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">Harga Terbaik</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Pilih Paket yang Tepat untuk Anda
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Investasi terbaik untuk kesuksesan bisnis Anda
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
            {plansData.map((plan, index) => {
              const isPopular = plan.name === 'Professional';
              const features = typeof plan.features === 'string'
                ? JSON.parse(plan.features)
                : plan.features || [];

              return (
                <div
                  key={plan.id}
                  className={`relative group ${isPopular ? 'lg:-translate-y-4' : ''}`}
                  data-aos="fade-up"
                  data-aos-delay={index * 100}
                >
                  {isPopular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                      <span className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                        🔥 Paling Populer
                      </span>
                    </div>
                  )}

                  <div
                    className={`h-full bg-white dark:bg-gray-800 rounded-2xl p-8 border-2 transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 ${
                      isPopular
                        ? 'border-green-500 shadow-xl shadow-green-500/20 scale-105'
                        : 'border-gray-200 dark:border-gray-700 hover:border-green-500/50'
                    }`}
                    style={{
                      transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)',
                      transition: 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s ease'
                    }}
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const y = e.clientY - rect.top;
                      const centerX = rect.width / 2;
                      const centerY = rect.height / 2;
                      const rotateX = (y - centerY) / 20;
                      const rotateY = (centerX - x) / 20;
                      e.currentTarget.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
                    }}
                  >
                    <div className="text-center mb-6">
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        {plan.name}
                      </h3>
                      {plan.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {plan.description}
                        </p>
                      )}
                    </div>

                    <div className="text-center mb-8">
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                          Rp {(plan.price / 1000).toFixed(0)}K
                        </span>
                        {plan.price > 0 && (
                          <span className="text-gray-500 dark:text-gray-400 text-sm">/bulan</span>
                        )}
                      </div>
                      {plan.price === 0 && (
                        <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                          Gratis Selamanya
                        </span>
                      )}
                    </div>

                    <ul className="space-y-3 mb-8">
                      {features.map((feature: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
                          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      onClick={() => navigate("/auth")}
                      className={`w-full ${
                        isPopular
                          ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg shadow-green-500/30'
                          : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100'
                      } group transition-all duration-300`}
                    >
                      Pilih Paket
                      <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Trust Badge */}
          <div className="text-center mt-12" data-aos="fade-up" data-aos-delay="400">
            <div className="inline-flex items-center gap-6 px-6 py-3 bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="text-sm text-gray-700 dark:text-gray-300">7 Hari Gratis</span>
              </div>
              <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Tanpa Kartu Kredit</span>
              </div>
              <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Cancel Kapan Saja</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Comparison Table */}
      <section className="container mx-auto px-4 py-24">
        <div className="text-center mb-16" data-aos="fade-up">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            HalloWa vs Manual WhatsApp
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Lihat perbedaan signifikan dalam efisiensi dan hasil
          </p>
        </div>

        <div className="max-w-4xl mx-auto" data-aos="fade-up" data-aos-delay="100">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-3 gap-4 p-6 bg-gray-50 dark:bg-gray-900 font-semibold border-b border-gray-200 dark:border-gray-700">
              <div>Fitur</div>
              <div className="text-center">Manual WhatsApp</div>
              <div className="text-center text-green-600">HalloWa</div>
            </div>
            {comparison.map((item, index) => (
              <div 
                key={index} 
                className="grid grid-cols-3 gap-4 p-6 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="font-medium text-gray-900 dark:text-white">{item.feature}</div>
                <div className="text-center text-red-600 flex items-center justify-center gap-2">
                  <X className="w-4 h-4" />
                  {item.manual}
                </div>
                <div className="text-center text-green-600 flex items-center justify-center gap-2 font-semibold">
                  <Check className="w-5 h-5" />
                  {item.hallowa}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="container mx-auto px-4 py-24">
        <div className="text-center mb-16" data-aos="fade-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
            <Star className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">Testimonial</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Kata Mereka Tentang HalloWa
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Ribuan bisnis sudah merasakan manfaatnya
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div 
              key={index}
              className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow"
              data-aos="fade-up"
              data-aos-delay={index * 100}
            >
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6 italic">
                "{testimonial.text}"
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold">
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">{testimonial.name}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{testimonial.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-gradient-to-br from-green-600 to-emerald-600 py-24 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }} />
        </div>
        <div className="container mx-auto px-4 relative">
          <div className="max-w-4xl mx-auto">
            <h2 
              className="text-4xl md:text-5xl font-bold text-white mb-12 text-center"
              data-aos="fade-up"
            >
              Kenapa Pilih HalloWa?
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {benefits.map((benefit, index) => (
                <div 
                  key={index} 
                  className="flex items-center gap-4 text-white bg-white/10 backdrop-blur-sm rounded-xl p-4 hover:bg-white/20 transition-colors"
                  data-aos="fade-right"
                  data-aos-delay={index * 50}
                >
                  <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
                  <span className="text-lg font-medium">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="container mx-auto px-4 py-24">
        <div className="text-center mb-16" data-aos="fade-up">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Pertanyaan yang Sering Diajukan
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Temukan jawaban untuk pertanyaan umum
          </p>
        </div>

        <div className="max-w-3xl mx-auto" data-aos="fade-up" data-aos-delay="100">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <AccordionTrigger className="text-left font-semibold text-gray-900 dark:text-white hover:no-underline py-5">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-gray-600 dark:text-gray-300 pb-5">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Contact Section */}
      {contactData.email && (
        <section id="contact" className="container mx-auto px-4 py-24">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16" data-aos="fade-up">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
                <Mail className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">Hubungi Kami</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
                Kontak
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300">
                Kami siap membantu Anda. Hubungi kami melalui informasi berikut
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div
                className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 text-center hover:shadow-xl transition-shadow"
                data-aos="fade-up"
                data-aos-delay="0"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Email</h3>
                <a href={`mailto:${contactData.email}`} className="text-green-600 dark:text-green-400 hover:underline">
                  {contactData.email}
                </a>
              </div>

              <div
                className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 text-center hover:shadow-xl transition-shadow"
                data-aos="fade-up"
                data-aos-delay="100"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Phone className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Telepon</h3>
                <a href={`tel:${contactData.phone.replace(/\s/g, '')}`} className="text-green-600 dark:text-green-400 hover:underline">
                  {contactData.phone}
                </a>
              </div>

              <div
                className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 text-center hover:shadow-xl transition-shadow"
                data-aos="fade-up"
                data-aos-delay="200"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Alamat</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {contactData.address}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-24 text-center">
        <div className="max-w-3xl mx-auto">
          <h2
            className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6"
            data-aos="zoom-in"
          >
            Siap Tingkatkan Marketing Anda?
          </h2>
          <p
            className="text-xl text-gray-600 dark:text-gray-300 mb-10"
            data-aos="zoom-in"
            data-aos-delay="100"
          >
            Bergabung dengan ribuan bisnis yang sudah menggunakan HalloWa
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/auth")}
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-lg px-10 py-6 shadow-xl shadow-green-500/30 group magnetic-button animate-scale-in"
            data-aos="zoom-in"
            data-aos-delay="200"
          >
            Mulai Gratis Sekarang <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
            Free trial 7 hari • Tidak perlu kartu kredit • Setup dalam 5 menit
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12" data-aos="fade-up">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">HalloWa</span>
            </div>
            <div className="flex gap-6 text-gray-400">
              <button onClick={() => scrollToSection('about')} className="hover:text-white transition-colors">
                Tentang
              </button>
              <button onClick={() => scrollToSection('features')} className="hover:text-white transition-colors">
                Fitur
              </button>
              <button onClick={() => scrollToSection('pricing')} className="hover:text-white transition-colors">
                Harga
              </button>
              <button onClick={() => scrollToSection('contact')} className="hover:text-white transition-colors">
                Kontak
              </button>
            </div>
            <p className="text-gray-400 text-sm">
              © 2024 HalloWa. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Stats Counter Component with Scroll Trigger Animation
const StatsCounter = ({ value, suffix, label }: { value: number; suffix: string; label: string }) => {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const counterRef = useState<HTMLDivElement | null>(null)[0];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated) {
          setHasAnimated(true);

          const duration = 2000;
          const steps = 60;
          const increment = value / steps;
          let current = 0;

          const timer = setInterval(() => {
            current += increment;
            if (current >= value) {
              setCount(value);
              clearInterval(timer);
            } else {
              setCount(Math.floor(current));
            }
          }, duration / steps);

          return () => clearInterval(timer);
        }
      },
      { threshold: 0.5 }
    );

    if (counterRef) {
      observer.observe(counterRef);
    }

    return () => {
      if (counterRef) {
        observer.unobserve(counterRef);
      }
    };
  }, [value, hasAnimated, counterRef]);

  return (
    <div ref={(el) => { if (el) counterRef = el; }}>
      <div className="text-3xl font-bold text-gray-900 dark:text-white">
        {count.toLocaleString()}{suffix}
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-400">{label}</div>
    </div>
  );
};

// Chat Animation Component
const ChatAnimation = () => {
  const [messages, setMessages] = useState<Array<{text: string, isBot: boolean}>>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  const conversation = [
    { text: "Halo, bisa bantu saya?", isBot: false },
    { text: "Tentu! Ada yang bisa saya bantu? 😊", isBot: true },
    { text: "Bagaimana cara menggunakan broadcast?", isBot: false },
    { text: "Sangat mudah! Tinggal pilih kontak, tulis pesan, dan kirim. Otomatis terkirim ke semua! 🚀", isBot: true },
    { text: "Wah, cepat banget!", isBot: false },
    { text: "Yup! Ayo coba sekarang 🎉", isBot: true },
  ];

  useEffect(() => {
    if (currentIndex >= conversation.length) {
      setTimeout(() => {
        setMessages([]);
        setCurrentIndex(0);
      }, 3000);
      return;
    }

    setIsTyping(true);
    const typingDelay = conversation[currentIndex].isBot ? 1500 : 1000;

    const typingTimer = setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, conversation[currentIndex]]);
      setCurrentIndex(prev => prev + 1);
    }, typingDelay);

    return () => clearTimeout(typingTimer);
  }, [currentIndex, messages.length]);

  return (
    <div className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-6 max-w-md mx-auto border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
          <Bot className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">HalloWa Bot</div>
          <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Online
          </div>
        </div>
      </div>

      <div className="space-y-3 min-h-[300px]">
        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            className={`flex ${msg.isBot ? 'justify-start' : 'justify-end'} animate-fade-in`}
          >
            <div 
              className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                msg.isBot 
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-tl-none' 
                  : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-tr-none'
              } shadow-md`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        
        {isTyping && currentIndex < conversation.length && conversation[currentIndex].isBot && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-2xl rounded-tl-none shadow-md">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Landing;
