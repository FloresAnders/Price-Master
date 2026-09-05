import Image from "next/image";
import { Sparkles } from "lucide-react";

export default function PatrioticSeptemberBadge() {
	return (
		<>
			<div
				className="hidden items-center gap-3 rounded-2xl border border-blue-400/20 bg-blue-950/40 px-4 py-2 shadow-[0_0_30px_rgba(30,64,175,0.15)] backdrop-blur-xl md:flex"
				aria-label="15 de Septiembre, Independencia de Costa Rica"
			>
				<Image src="/banderaCR.png" alt="Bandera de Costa Rica" width={32} height={20} className="h-5 w-8 rounded-sm object-cover" />
				<div>
					<p className="text-xs font-semibold text-white">15 de Septiembre · Independencia de Costa Rica</p>
					<p className="text-[11px] text-white/55">Mes de la Patria</p>
				</div>
			</div>
			<div className="flex items-center gap-2 text-xs text-white md:hidden">
				<Image src="/banderaCR.png" alt="Bandera de Costa Rica" width={24} height={16} className="h-4 w-6 rounded-sm object-cover" />
				<span>15 de Septiembre</span>
			</div>
		</>
	);
}
