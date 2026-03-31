import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import {
  MapPin,
  Phone,
  Globe,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Mail,
} from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import bannerImg from "@/assets/about-banner.jpg";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSettings } from "@/contexts/SettingsContext";
import api from "@/lib/api";
import { toast } from "sonner";
import SEO from "@/components/SEO";

export default function ContactUs() {
  const { t } = useTranslation();
  const [isSuccess, setIsSuccess] = useState(false);
  const { settings, isLoading } = useSettings();
  // Scroll Progress Logic
  const [scrollProgress, setScrollProgress] = useState(0);

  const [subjects, setSubjects] = useState<any[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);

  // Fetch active subjects
  useEffect(() => {
    const fetchActiveSubjects = async () => {
      try {
        const res = await api.get("/inquiries/subjects/active");
        setSubjects(res.data);
      } catch (error) {
        console.error("Gagal mengambil daftar subjek:", error);
      } finally {
        setIsLoadingSubjects(false);
      }
    };
    fetchActiveSubjects();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress = (window.scrollY / totalHeight) * 100;
      setScrollProgress(progress);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 1. UPDATE SCHEMA: Tambahkan Company (Opsional) dan Subject (Wajib)
  const contactSchema = z.object({
    name: z
      .string()
      .min(3, { message: "Full name must be filled (min. 3 characters)" }),
    phone: z
      .string()
      .min(9, { message: "Invalid phone number" })
      .regex(
        /^[0-9+\-\s]+$/,
        "Only numbers and the + and - symbols are allowed.",
      ),
    email: z.string().email({ message: "Invalid email format" }),
    company: z.string().optional(), // Opsional
    subject: z.string().min(1, { message: "Please select an inquiry subject" }), // Wajib pilih
    message: z
      .string()
      .min(10, { message: "Message too short (min. 10 characters)" }),
  });

  type ContactFormValues = z.infer<typeof contactSchema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      subject: "",
    },
  });

  const onSubmit = async (data: ContactFormValues) => {
    try {
      await api.post("/inquiries", {
        ...data,
        company: data.company || "", // Menjamin string kosong jika undefined
      });

      setIsSuccess(true);
      reset(); // Bersihkan form
      toast.success(
        t("contactPage.form.success", "Message sent successfully!"),
      );
      // Reset status sukses setelah 5 detik agar notifikasi hilang
      setTimeout(() => setIsSuccess(false), 5000);
    } catch (error: any) {
      console.error("Submission error:", error);
      // Feedback error yang lebih informatif
      toast.error(
        error.response?.data?.message ||
          "An error occurred while sending the message. Please try again.",
      );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-sans text-slate-500">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-daw-green border-t-transparent rounded-full animate-spin"></div>
          Loading contact info...
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title={t("contactPage.title", "Contact Us")}
        description={t(
          "contactPage.description",
          "Get in touch with PT Dharma Agung Wijaya Group.",
        )}
      />
      <div className="bg-white min-h-screen">
        {/* Progress Scrolling Bar */}
        <div
          className="fixed top-0 left-0 h-1.5 bg-gradient-to-r from-daw-green via-emerald-400 to-daw-green z-[100] transition-all duration-150 ease-out shadow-[0_0_10px_rgba(16,185,129,0.5)]"
          style={{ width: `${scrollProgress}%` }}
        />
        {/* --- BANNER SECTION --- */}
        <section className="relative h-[85vh] flex items-center justify-center overflow-hidden">
          {/* Background Image with Slow Zoom Animation */}
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-105"
            style={{
              backgroundImage: `url(${bannerImg})`,
              backgroundAttachment: "fixed", // Menambahkan efek parallax
            }}
          />
          {/* DAW Green Overlay (Multiply for rich color blending) */}
          <div className="absolute inset-0 bg-daw-green/70 mix-blend-multiply" />
          {/* Gradient Overlay untuk keterbacaan teks */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/40 to-slate-900/80" />{" "}
          {/* Text Content */}
          <div className="relative z-10 text-center px-6 max-w-5xl mt-16 animate-in fade-in slide-in-from-bottom-12 duration-1000">
            <ScrollReveal direction="up" delay={0}>
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold text-white mb-10 leading-[1.1] tracking-tight drop-shadow-lg">
                {t("contactPage.title", "Get in Touch")}
              </h1>
            </ScrollReveal>
            <ScrollReveal direction="up" delay={200}>
              {/* Dekorasi Garis (Mirip di Dynamic Page) */}
              <div className="flex items-center justify-center gap-8">
                <div className="h-px w-16 bg-white/30" />
                <div className="w-3 h-3 border-2 border-daw-green rotate-45" />
                <div className="h-px w-16 bg-white/30" />
              </div>
            </ScrollReveal>
          </div>
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/50 animate-bounce">
            <span className="text-[10px] font-bold tracking-widest uppercase">
              Scroll to Explore
            </span>
            <ChevronRight className="rotate-90 w-4 h-4" />
          </div>
        </section>

        {/* --- MAIN SPLIT LAYOUT --- */}
        <section className="py-20 bg-[#F8F9FA]">
          <div className="container mx-auto px-6 max-w-7xl">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <ScrollReveal direction="up" delay={0}>
                <p className="font-sans text-slate-600 text-lg leading-relaxed">
                  {t(
                    "contactPage.description",
                    "Whether you have a question about our operations, sustainability initiatives, or potential partnerships, our team is ready to answer all your questions.",
                  )}
                </p>
              </ScrollReveal>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
              {/* KIRI: CORPORATE INFO & MAP */}
              <div className="lg:col-span-5 space-y-8 lg:sticky lg:top-32">
                <ScrollReveal direction="right" delay={200}>
                  <div className="bg-white rounded-[2rem] p-8 md:p-10 border border-slate-200 shadow-[0_10px_40px_rgba(0,0,0,0.03)] flex flex-col gap-10">
                    <div className="w-full h-64 bg-slate-100 rounded-2xl overflow-hidden border border-slate-200">
                      <iframe
                        src={settings?.googleMapsUrl || ""}
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        allowFullScreen
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        title="DAW Headquarters Location"
                      ></iframe>
                    </div>

                    <div className="space-y-8">
                      <div className="flex items-start gap-5 group">
                        <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 group-hover:bg-daw-green group-hover:border-daw-green transition-colors duration-300">
                          <MapPin className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors duration-300" />
                        </div>
                        <div>
                          <h4 className="font-serif font-bold text-slate-900 text-lg mb-2">
                            {t("contactPage.info.addressTitle", "Head Office")}
                          </h4>
                          <p className="font-sans text-slate-600 text-sm leading-relaxed whitespace-pre-line">
                            {settings?.address}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-5 group">
                        <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 group-hover:bg-daw-green group-hover:border-daw-green transition-colors duration-300">
                          <Phone className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors duration-300" />
                        </div>
                        <div>
                          <h4 className="font-serif font-bold text-slate-900 text-lg mb-1">
                            {t("contactPage.info.phoneTitle", "Phone")}
                          </h4>
                          <a
                            href={`tel:${settings?.phone ? settings.phone.replace(/\s+/g, "") : ""}`}
                            className="font-sans text-slate-600 text-sm hover:text-daw-green transition-colors"
                          >
                            {settings?.phone || "+62 21 2966 1956"}
                          </a>
                        </div>
                      </div>

                      <div className="flex items-start gap-5 group">
                        <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 group-hover:bg-daw-green group-hover:border-daw-green transition-colors duration-300">
                          <Globe className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors duration-300" />
                        </div>
                        <div>
                          <h4 className="font-serif font-bold text-slate-900 text-lg mb-1">
                            {t("contactPage.info.websiteTitle", "Website")}
                          </h4>
                          <a
                            href={
                              settings?.website?.startsWith("http")
                                ? settings.website
                                : `https://${settings?.website || "www.daw.co.id"}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-sans text-slate-600 text-sm hover:text-daw-green transition-colors"
                          >
                            {settings?.website || "www.daw.co.id"}
                          </a>
                        </div>
                      </div>
                      <div className="flex items-start gap-5 group">
                        <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 group-hover:bg-daw-green group-hover:border-daw-green transition-colors duration-300">
                          <Mail className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors duration-300" />
                        </div>
                        <div>
                          <h4 className="font-serif font-bold text-slate-900 text-lg mb-1">
                            {t("contactPage.info.emailTitle", "Email Address")}
                          </h4>
                          <a
                            href={`mailto:${settings?.email || "info@daw.co.id"}`}
                            className="font-sans text-slate-600 text-sm hover:text-daw-green transition-colors"
                          >
                            {settings?.email || "info@daw.co.id"}
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollReveal>
              </div>

              {/* KANAN: THE INQUIRY FORM */}
              <div className="lg:col-span-7">
                <ScrollReveal direction="left" delay={400}>
                  <div className="bg-white rounded-[2rem] p-8 md:p-12 border border-slate-200 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-daw-green/5 rounded-bl-full pointer-events-none"></div>

                    <div className="mb-10">
                      <h3 className="font-serif text-3xl text-slate-900 mb-2">
                        {t("contactPage.form.title", "Send us a Message")}
                      </h3>
                      <div className="w-16 h-1 bg-daw-green rounded-full"></div>
                    </div>

                    <form
                      onSubmit={handleSubmit(onSubmit)}
                      className="space-y-6"
                    >
                      {/* Baris 1: Name & Phone */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                            {t("contactPage.form.name", "Full Name")}{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <input
                            {...register("name")}
                            type="text"
                            placeholder={t(
                              "contactPage.form.namePlaceholder",
                              "John Doe",
                            )}
                            className={`w-full bg-slate-50 border rounded-xl px-4 py-3.5 text-slate-900 font-sans focus:outline-none transition-all ${
                              errors.name
                                ? "border-red-400 focus:ring-2 focus:ring-red-100"
                                : "border-slate-200 focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green"
                            }`}
                          />
                          {errors.name && (
                            <p className="text-red-500 text-xs mt-1">
                              {errors.name.message}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                            {t("contactPage.form.phone", "Phone Number")}{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <input
                            {...register("phone")}
                            type="tel"
                            placeholder={t(
                              "contactPage.form.phonePlaceholder",
                              "+62 812...",
                            )}
                            className={`w-full bg-slate-50 border rounded-xl px-4 py-3.5 text-slate-900 font-sans focus:outline-none transition-all ${
                              errors.phone
                                ? "border-red-400 focus:ring-2 focus:ring-red-100"
                                : "border-slate-200 focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green"
                            }`}
                          />
                          {errors.phone && (
                            <p className="text-red-500 text-xs mt-1">
                              {errors.phone.message}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Baris 2: Email & Company */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                            {t("contactPage.form.email", "Email Address")}{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <input
                            {...register("email")}
                            type="email"
                            placeholder={t(
                              "contactPage.form.emailPlaceholder",
                              "john@example.com",
                            )}
                            className={`w-full bg-slate-50 border rounded-xl px-4 py-3.5 text-slate-900 font-sans focus:outline-none transition-all ${
                              errors.email
                                ? "border-red-400 focus:ring-2 focus:ring-red-100"
                                : "border-slate-200 focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green"
                            }`}
                          />
                          {errors.email && (
                            <p className="text-red-500 text-xs mt-1">
                              {errors.email.message}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                            {t(
                              "contactPage.form.company",
                              "Company / Organization",
                            )}{" "}
                            <span className="text-slate-400 font-normal lowercase tracking-normal">
                              (Optional)
                            </span>
                          </label>
                          <input
                            {...register("company")}
                            type="text"
                            placeholder={t(
                              "contactPage.form.companyPlaceholder",
                              "Enter your organization",
                            )}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 font-sans focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green transition-all"
                          />
                        </div>
                      </div>

                      {/* Baris 3: Subject Dropdown */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                          {t(
                            "contactPage.form.subjectLabel",
                            "Inquiry Subject",
                          )}{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <select
                            {...register("subject")}
                            className={`w-full bg-slate-50 border rounded-xl pl-4 pr-10 py-3.5 text-slate-900 font-sans focus:outline-none transition-all appearance-none cursor-pointer ${
                              errors.subject
                                ? "border-red-400 focus:ring-2 focus:ring-red-100"
                                : "border-slate-200 focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green"
                            }`}
                          >
                            <option value="" disabled>
                              {isLoadingSubjects
                                ? "Loading subjects..."
                                : "Select a subject..."}
                            </option>

                            {/* MAPPING DINAMIS DARI DATABASE */}
                            {subjects.map((sub) => (
                              <option key={sub.id} value={sub.name}>
                                {sub.name}
                              </option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          </div>
                        </div>
                        {errors.subject && (
                          <p className="text-red-500 text-xs mt-1">
                            {errors.subject.message}
                          </p>
                        )}
                      </div>

                      {/* Baris 4: Message */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                          {t("contactPage.form.message", "Message")}{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          {...register("message")}
                          rows={5}
                          placeholder={t(
                            "contactPage.form.messagePlaceholder",
                            "How can we help you today?",
                          )}
                          className={`w-full bg-slate-50 border rounded-xl px-4 py-3.5 text-slate-900 font-sans resize-none focus:outline-none transition-all ${
                            errors.message
                              ? "border-red-400 focus:ring-2 focus:ring-red-100"
                              : "border-slate-200 focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green"
                          }`}
                        ></textarea>
                        {errors.message && (
                          <p className="text-red-500 text-xs mt-1">
                            {errors.message?.message}
                          </p>
                        )}
                      </div>

                      {/* Notifikasi Sukses */}
                      {isSuccess && (
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-4 rounded-xl flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                          <CheckCircle2 className="w-6 h-6 shrink-0" />
                          <span className="text-sm font-medium leading-tight">
                            {t(
                              "contactPage.form.success",
                              "Your message has been sent successfully. Our team will get back to you shortly.",
                            )}
                          </span>
                        </div>
                      )}

                      {/* Tombol Submit */}
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="group w-full inline-flex items-center justify-center gap-3 bg-[#081C15] hover:bg-daw-green disabled:bg-slate-400 disabled:cursor-not-allowed text-white px-8 py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all duration-300 shadow-md hover:shadow-lg"
                      >
                        {isSubmitting ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>
                              {t("contactPage.form.sending", "Sending...")}
                            </span>
                          </>
                        ) : (
                          <>
                            <span>
                              {t("contactPage.form.submit", "Submit Message")}
                            </span>
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                </ScrollReveal>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
