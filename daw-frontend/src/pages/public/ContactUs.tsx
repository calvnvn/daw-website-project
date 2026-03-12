import { useTranslation } from "react-i18next";
import { useState } from "react";
import { MapPin, Phone, Globe, ArrowRight, CheckCircle2 } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import bannerImg from "@/assets/about-banner.jpg";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSettings } from "@/contexts/SettingsContext";

export default function ContactUs() {
  const { t } = useTranslation();
  const [isSuccess, setIsSuccess] = useState(false);
  const { settings, isLoading } = useSettings();

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
  });

  const onSubmit = async (data: ContactFormValues) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));

    console.log("Data Ready to be Sent to Admin Panel:", data);

    setIsSuccess(true);
    reset();

    setTimeout(() => setIsSuccess(false), 5000);
  };

  const contactData = {
    mapEmbedUrl:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3965.993077647209!2d106.7997972153702!3d-6.290886195446487!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e69f1fb25b84539%3A0xc6226d9c612f0b78!2sAlamanda%20Tower!5e0!3m2!1sen!2sid!4v1680000000000!5m2!1sen!2sid",
    address:
      "Alamanda Tower, 22nd Floor.\nJl. TB Simatupang Kav 23-24,\nCilandak Barat, South Jakarta",
    phone: "+62 21 2966 1956",
    website: "www.daw.co.id",
    email: "contact@daw.co.id",
  };

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading contact info...
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      {/* --- HERO BANNER SECTION --- */}
      <section className="relative w-full h-[50vh] min-h-[400px] flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 w-full h-full bg-cover bg-center transform scale-100 hover:scale-105 transition-transform duration-[20000ms] ease-out"
          style={{ backgroundImage: `url(${bannerImg})` }}
        />
        <div className="absolute inset-0 bg-[#004B23]/80 mix-blend-multiply" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#081C15] via-transparent to-transparent" />

        {/* Teks Banner */}
        <div className="relative z-10 text-center px-6 mt-16 max-w-4xl">
          <ScrollReveal direction="up" delay={0}>
            <h1 className="text-5xl md:text-6xl font-serif text-white tracking-tight drop-shadow-lg mb-6">
              {t("contactPage.title")}
            </h1>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={200}>
            <p className="text-lg md:text-xl text-slate-300 font-light tracking-widest uppercase">
              {t("contactPage.subtitle")}
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* --- MAIN SPLIT LAYOUT (Konten) --- */}
      <section className="py-20 bg-[#F8F9FA]">
        <div className="container mx-auto px-6 max-w-7xl">
          {/* Deskripsi Pembuka */}
          <div className="text-center max-w-3xl mx-auto mb-16">
            <ScrollReveal direction="up" delay={0}>
              <p className="font-sans text-slate-600 text-lg leading-relaxed">
                {t("contactPage.description")}
              </p>
            </ScrollReveal>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
            {/* KIRI: CORPORATE INFO & MAP (Col 5) */}
            <div className="lg:col-span-5 space-y-8 lg:sticky lg:top-32">
              <ScrollReveal direction="right" delay={200}>
                <div className="bg-white rounded-[2rem] p-8 md:p-10 border border-slate-200 shadow-[0_10px_40px_rgba(0,0,0,0.03)] flex flex-col gap-10">
                  {/* Google Map Embed */}
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

                  {/* Contact Details */}
                  <div className="space-y-8">
                    <div className="flex items-start gap-5 group">
                      <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 group-hover:bg-daw-green group-hover:border-daw-green transition-colors duration-300">
                        <MapPin className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors duration-300" />
                      </div>
                      <div>
                        <h4 className="font-serif font-bold text-slate-900 text-lg mb-2">
                          {t("contactPage.info.addressTitle")}
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
                          {t("contactPage.info.phoneTitle")}
                        </h4>
                        <a
                          href={`tel:${contactData.phone.replace(/\s+/g, "")}`}
                          className="font-sans text-slate-600 text-sm hover:text-daw-green transition-colors"
                        >
                          {settings?.phone}
                        </a>
                      </div>
                    </div>

                    <div className="flex items-start gap-5 group">
                      <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 group-hover:bg-daw-green group-hover:border-daw-green transition-colors duration-300">
                        <Globe className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors duration-300" />
                      </div>
                      <div>
                        <h4 className="font-serif font-bold text-slate-900 text-lg mb-1">
                          {t("contactPage.info.websiteTitle")}
                        </h4>
                        <a
                          href={`https://${contactData.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-sans text-slate-600 text-sm hover:text-daw-green transition-colors"
                        >
                          {settings?.website}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            </div>

            {/* KANAN: THE INQUIRY FORM (Col 7) */}
            <div className="lg:col-span-7">
              <ScrollReveal direction="left" delay={400}>
                <div className="bg-white rounded-[2rem] p-8 md:p-12 border border-slate-200 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-daw-green/5 rounded-bl-full pointer-events-none"></div>

                  <div className="mb-10">
                    <h3 className="font-serif text-3xl text-slate-900 mb-2">
                      {t("contactPage.form.title")}
                    </h3>
                    <div className="w-16 h-1 bg-daw-green rounded-full"></div>
                  </div>

                  {/* FORM STRUCTURE */}
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                          {t("contactPage.form.name")}
                        </label>
                        <input
                          {...register("name")}
                          type="text"
                          placeholder={t("contactPage.form.namePlaceholder")}
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
                          {t("contactPage.form.phone")}
                        </label>
                        <input
                          {...register("phone")}
                          type="tel"
                          placeholder={t("contactPage.form.phonePlaceholder")}
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

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                        {t("contactPage.form.email")}
                      </label>
                      <input
                        {...register("email")}
                        type="email"
                        placeholder={t("contactPage.form.emailPlaceholder")}
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
                        {t("contactPage.form.message")}
                      </label>
                      <textarea
                        {...register("message")}
                        rows={5}
                        placeholder={t("contactPage.form.messagePlaceholder")}
                        className={`w-full bg-slate-50 border rounded-xl px-4 py-3.5 text-slate-900 font-sans resize-none focus:outline-none transition-all ${
                          errors.message
                            ? "border-red-400 focus:ring-2 focus:ring-red-100"
                            : "border-slate-200 focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green"
                        }`}
                      ></textarea>
                      {errors.message && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.message.message}
                        </p>
                      )}
                    </div>
                    {isSuccess && (
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl flex items-center gap-3 animate-pulse">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="text-sm font-medium">
                          {t(
                            "contactPage.form.success",
                            "Mesej berjaya dihantar. Kami akan membalas segera.",
                          )}
                        </span>
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="group w-full md:w-auto inline-flex items-center justify-center gap-3 bg-[#081C15] hover:bg-daw-green disabled:bg-slate-400 disabled:cursor-not-allowed text-white px-8 py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all duration-300"
                    >
                      <span>
                        {isSubmitting
                          ? t("contactPage.form.sending", "Menghantar...")
                          : t("contactPage.form.submit")}
                      </span>
                      {!isSubmitting && (
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
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
  );
}
