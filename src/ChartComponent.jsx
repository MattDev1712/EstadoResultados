import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

Chart.register(...registerables, ChartDataLabels);

const ChartComponent = ({ type, data, options, title }) => {
    const chartRef = useRef(null);
    const canvasRef = useRef(null);

    useEffect(() => {
        if (canvasRef.current) {
            if (chartRef.current) {
                chartRef.current.destroy();
            }
            
            const ctx = canvasRef.current.getContext('2d');
            chartRef.current = new Chart(ctx, {
                type: type,
                data: data,
                plugins: [ChartDataLabels],
                options: {
                    ...options,
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                            titleColor: '#f8fafc',
                            bodyColor: '#cbd5e1',
                            borderColor: 'rgba(51, 65, 85, 0.5)',
                            borderWidth: 1,
                            padding: 10,
                            displayColors: true,
                            ...options?.plugins?.tooltip
                        },
                        ...options?.plugins
                    },
                    scales: options?.scales
                }
            });
        }
        return () => { if (chartRef.current) chartRef.current.destroy(); };
    }, [data, type, options]);

    return (
        <div className="bg-slate-800/50 p-5 rounded-2xl shadow-sm border border-slate-700/50 h-80 flex flex-col backdrop-blur-sm">
            <h3 className="text-slate-400 font-semibold mb-4 text-xs uppercase tracking-wider flex justify-between items-center">
                {title}
            </h3>
            <div className="relative flex-1">
                <canvas ref={canvasRef}></canvas>
            </div>
        </div>
    );
};

export default ChartComponent;