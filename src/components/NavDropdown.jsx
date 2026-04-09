import React, { useState, useEffect, useRef } from 'react';

const NavDropdown = ({ title, icon, items, activeTab, setActiveTab }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const activeItem = items.find(item => item.id === activeTab);

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold transition-all border ${
                    activeItem || isOpen
                    ? 'bg-white/10 text-white border-white/20 shadow-lg'
                    : 'text-slate-400 border-transparent hover:bg-white/5 hover:text-slate-200'
                }`}
            >
                <span className="text-sm opacity-80">{icon}</span>
                <span>{title}</span>
                <span className={`text-[10px] opacity-40 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {isOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-[100] overflow-hidden animate-pop-in">
                    <div className="p-1 px-1.5 flex flex-col gap-1">
                        {items.map(item => (
                            <button
                                key={item.id}
                                onClick={() => {
                                    setActiveTab(item.id);
                                    setIsOpen(false);
                                }}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all text-left ${
                                    activeTab === item.id
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                }`}
                            >
                                <span className="text-sm">{item.icon}</span>
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NavDropdown;
