// import { Link } from "react-router-dom";
import BusinessGrid from "@/components/BusinessGrid";
import Hero from "@/components/Hero";
import ImpactStatistics from "@/components/ImpactStatistics";
import TransformationIntro from "@/components/TransformationIntro";
import OtherInvestmentsTeaser from "@/components/OtherInvestmentsTeaser";

export default function Home() {
  return (
    <>
      <Hero />
      <TransformationIntro />
      <ImpactStatistics />
      <BusinessGrid />
      <OtherInvestmentsTeaser />
    </>
  );
}
