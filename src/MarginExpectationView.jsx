import React from 'react';

const MarginExpectationView = () => {
    return (
        <div className="animate-fade-in mt-8">
            <div className="bg-slate-900/40 border border-slate-800 rounded-[3rem] p-12 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none"></div>
                
                <div className="relative z-10 flex flex-col items-center">
                    <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center mb-6 ring-1 ring-blue-500/20">
                        <span className="text-4xl">📈</span>
                    </div>
                    
                    <h2 className="text-3xl font-black text-white tracking-tight mb-4">
                        Expectativa de Margen de Ganancia
                    </h2>
                    
                    <p className="text-slate-400 max-w-xl text-lg leading-relaxed mb-10">
                        Esta sección está siendo desarrollada. Aquí podrás proyectar tus márgenes ideales, 
                        analizar la rentabilidad por producto y simular escenarios de precios para optimizar 
                        tus ganancias.
                    </p>
                    
                    <div className="flex gap-4">
                        <div className="px-4 py-2 bg-slate-800 rounded-full border border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Próximamente
                        </div>
                        <div className="px-4 py-2 bg-blue-500/10 rounded-full border border-blue-500/20 text-[10px] font-black uppercase tracking-widest text-blue-400">
                            Desarrollo en curso
                        </div>
                    </div>
                </div>

                {/* Decoración visual */}
                <div className="mt-16 grid grid-cols-3 gap-6 opacity-20 filter grayscale group-hover:grayscale-0 transition-all duration-700">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-40 bg-slate-800 rounded-2xl border border-slate-700 border-dashed animate-pulse" style={{ animationDelay: `${i * 0.2}s` }}></div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default MarginExpectationView;
