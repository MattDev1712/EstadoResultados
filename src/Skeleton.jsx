import React from 'react';

const Skeleton = ({ className = "", style = {} }) => (
    <div 
        className={`skeleton ${className}`} 
        style={style}
    />
);

export const CardSkeleton = () => (
    <div className="bg-slate-900/40 border border-slate-800/40 rounded-2xl p-6 h-40 flex flex-col justify-between">
        <Skeleton className="w-1/3 h-4" />
        <Skeleton className="w-2/3 h-10" />
        <div className="space-y-2">
            <Skeleton className="w-full h-2" />
            <Skeleton className="w-full h-2" />
        </div>
    </div>
);

export const ChartSkeleton = () => (
    <div className="bg-slate-900/40 border border-slate-800/40 rounded-2xl p-6 h-80 flex flex-col">
        <div className="flex justify-between mb-8">
            <Skeleton className="w-1/4 h-6" />
            <div className="flex gap-2">
                <Skeleton className="w-12 h-4" />
                <Skeleton className="w-12 h-4" />
            </div>
        </div>
        <div className="flex-1 flex items-end gap-4 px-4">
            <Skeleton className="flex-1 h-[40%]" />
            <Skeleton className="flex-1 h-[70%]" />
            <Skeleton className="flex-1 h-[50%]" />
            <Skeleton className="flex-1 h-[90%]" />
            <Skeleton className="flex-1 h-[60%]" />
            <Skeleton className="flex-1 h-[80%]" />
        </div>
    </div>
);

export const TableSkeleton = ({ rows = 5 }) => (
    <div className="space-y-4">
        <div className="flex gap-4">
            <Skeleton className="flex-1 h-10" />
            <Skeleton className="w-24 h-10" />
        </div>
        {[...Array(rows)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-slate-800/40">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="w-1/4 h-4" />
                    <Skeleton className="w-1/2 h-3 opacity-50" />
                </div>
                <Skeleton className="w-16 h-6" />
            </div>
        ))}
    </div>
);

export default Skeleton;
