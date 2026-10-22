"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

// Leaflet cere `window`, deci landing-ul se randează doar în browser.
const LandingPage = dynamic(() => import("./LandingPage").then(m => m.LandingPage), { ssr: false });

export default function LandingClient() {
  const router = useRouter();
  return <LandingPage onLogin={() => router.push("/login")} />;
}
