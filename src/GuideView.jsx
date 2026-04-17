import React, { useState } from 'react';
// Importamos el objeto colors para usar las variables del tema
import { colors } from './theme';

// ─────────────────────────────────────────
// Sub-componentes internos
// ─────────────────────────────────────────

const StepBadge = ({ n }) => (
    <div style={{
        width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 900, color: 'white', flexShrink: 0,
        boxShadow: `0 4px 12px rgba(${parseInt(colors.blue.slice(1,3), 16)},${parseInt(colors.blue.slice(3,5), 16)},${parseInt(colors.blue.slice(5,7), 16)},0.25)`
    }}>
        {n}
    </div>
);

const Tag = ({ children, color = '#3b82f6' }) => (
    <span style={{
        fontSize: 9, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase',
        background: `${color}18`, color: color, border: `1px solid ${color}30`,
        padding: '3px 8px', borderRadius: 6
    }}>{children}</span>
);

const SectionTitle = ({ icon, title, subtitle }) => (
    <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 22 }}>{icon}</span>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: colors.textPrimary, margin: 0, letterSpacing: '-0.03em' }}>{title}</h2>
        </div>
        {subtitle && <p style={{ fontSize: 12, color: colors.textMuted, margin: 0, paddingLeft: 32 }}>{subtitle}</p>}
    </div>
);

const InfoCard = ({ icon, title, color = '#3b82f6', children, tag }) => (
    <div style={{
        background: colors.bgCard, border: `1px solid ${colors.borderCard}`, // Usar variables del tema
        borderLeft: `4px solid ${color}`, borderRadius: 14, // Mantener color semántico
        padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10
    }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>{icon}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: colors.textSecondary }}>{title}</span>
            </div> {/* Este color #e2e8f0 se mapea a textSecondary en dark mode, pero en light mode debería ser textPrimary o textSecondary */}
            {tag && <Tag color={color}>{tag}</Tag>}
        </div>
        <div style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.75, paddingLeft: 2 }}>
            {children}
        </div>
    </div>
);

const Accordion = ({ title, icon, children, defaultOpen = false }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div style={{ // Usar variables del tema
            background: colors.bgCard, border: `1px solid ${colors.borderCard}`, 
            borderRadius: 14, overflow: 'hidden',
            transition: 'box-shadow 0.2s',
            boxShadow: open ? '0 0 0 1px rgba(59,130,246,0.2)' : 'none'
        }}>
            <button
                onClick={() => setOpen(!open)}
                style={{
                    width: '100%', padding: '16px 20px', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', background: 'transparent', border: 'none',
                    cursor: 'pointer', textAlign: 'left', gap: 12
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: colors.textPrimary }}>{title}</span> {/* Usar variable del tema */}
                </div>
                <span style={{ // Usar variable del tema
                    fontSize: 14, color: colors.textMuted, transition: 'transform 0.25s', 
                    transform: open ? 'rotate(180deg)' : 'rotate(0deg)', display: 'block', fontWeight: 'bold' 
                }}>▾</span>
            </button>
            {open && (
                <div style={{
                    padding: '0 20px 20px', borderTop: `1px solid ${colors.borderSubtle}`,
                    paddingTop: 16, fontSize: 12, color: colors.textMuted, lineHeight: 1.85
                }}>
                    {children}
                </div>
            )}
        </div>
    );
};

const KpiPill = ({ label, color, value, desc }) => (
    <div style={{
        background: colors.bgCard, border: `1px solid ${colors.borderCard}`, // Usar variables del tema
        borderRadius: 14, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 
    }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', color: colors.textMuted }}>{label}</span>
            <span style={{
                fontSize: 10, fontWeight: 900, color, background: `${color}15`,
                padding: '3px 8px', borderRadius: 6, border: `1px solid ${color}25`
            }}>{value}</span>
        </div>
        <p style={{ fontSize: 11.5, color: colors.textSecondary, margin: 0, lineHeight: 1.7 }}>{desc}</p>
    </div>
);

const Highlight = ({ children }) => (
    <span style={{ color: colors.textPrimary, fontWeight: 700 }}>{children}</span>
);

const Tip = ({ children }) => (
    <div style={{
        marginTop: 10, padding: '10px 14px', background: `${colors.green}10`,
        border: `1px solid ${colors.green}25`, borderRadius: 10,
        fontSize: 11.5, color: colors.green, display: 'flex', gap: 8, alignItems: 'flex-start'
    }}>
        <span style={{ flexShrink: 0 }}>💡</span>
        <span style={{ lineHeight: 1.7 }}>{children}</span>
    </div>
);

const Warning = ({ children }) => ( // Refactorizado para usar variables del tema
    <div style={{
        marginTop: 10, padding: '10px 14px', background: `${colors.yellow}10`,
        border: `1px solid ${colors.yellow}25`, borderRadius: 10,
        fontSize: 11.5, color: colors.yellow, display: 'flex', gap: 8, alignItems: 'flex-start'
    }}>
        <span style={{ flexShrink: 0 }}>⚠️</span>
        <span style={{ lineHeight: 1.7 }}>{children}</span>
    </div>
);

// ─────────────────────────────────────────
// Vista principal
// ─────────────────────────────────────────

const GuideView = () => {
    const [activeSection, setActiveSection] = useState('como-funciona');

    const sections = [
        { id: 'como-funciona', label: '¿Cómo funciona?', icon: '🗺️' },
        { id: 'fuentes', label: 'Mis fuentes de datos', icon: '📂' },
        { id: 'kpis', label: 'Mis indicadores', icon: '📈' },
        { id: 'glosario', label: 'Glosario', icon: '📖' },
        { id: 'checklist', label: 'Lista mensual', icon: '✅' },
    ];

    return (
        <div className="animate-fade-in" style={{ paddingBottom: 60 }}>

            {/* Hero */}
            <div style={{
                borderRadius: 24, padding: '36px 40px', marginBottom: 28,
                background: `linear-gradient(135deg, rgba(${parseInt(colors.blue.slice(1,3), 16)},${parseInt(colors.blue.slice(3,5), 16)},${parseInt(colors.blue.slice(5,7), 16)},0.08) 0%, rgba(99,102,241,0.05) 50%, transparent 100%)`, // Mantener gradiente con color semántico
                border: `1px solid ${colors.borderCard}`, // Usar variable del tema
            }}>
                <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.25em', color: colors.blue, textTransform: 'uppercase', marginBottom: 8 }}>
                    Centro de Ayuda
                </p>
                <h1 style={{ fontSize: 26, fontWeight: 900, color: colors.textPrimary, letterSpacing: '-0.03em', marginBottom: 10 }}> {/* Usar variable del tema */}
                    Todo lo que necesitás saber para usar la app
                </h1>
                <p style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.8, maxWidth: 600, margin: 0 }}> {/* Usar variable del tema */}
                    Esta guía está pensada para cualquier persona, sin importar si nunca antes administraste un local.
                    Explicamos cada término, cada botón y cada número en lenguaje simple.
                </p>
            </div>

            {/* Nav interna */}
            <div style={{
                display: 'flex', gap: 6, marginBottom: 28, flexWrap: 'wrap',
                background: colors.bgSurface, padding: 6, borderRadius: 16,
                border: `1px solid ${colors.borderCard}`
            }}>
                {sections.map(s => (
                    <button
                        key={s.id}
                        onClick={() => setActiveSection(s.id)}
                        style={{
                            padding: '9px 16px', borderRadius: 10, fontSize: 11, fontWeight: 800,
                            border: 'none', cursor: 'pointer', transition: 'all 0.25s',
                            display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.02em',
                            background: activeSection === s.id ? colors.blue : 'transparent', // Mantener color semántico
                            color: activeSection === s.id ? '#ffffff' : colors.textMuted, // Usar variable del tema
                            boxShadow: activeSection === s.id ? '0 4px 12px rgba(59,130,246,0.2)' : 'none'
                        }}
                    >
                        <span>{s.icon}</span> {s.label}
                    </button>
                ))}
            </div>

            {/* ─── COMO FUNCIONA ─── */}
            {activeSection === 'como-funciona' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <SectionTitle icon="🗺️" title="¿Cómo funciona esta app?" subtitle="El recorrido completo de tus datos, explicado paso a paso." />

                    {/* Diagrama de flujo */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                        {[
                            { n: '1', icon: '🖨️', label: 'Tus sistemas emiten información', desc: 'Maxirest registra cada venta. AFIP/ARCA guarda cada factura de compra. Tu planilla tiene los sueldos.' },
                            { n: '2', icon: '📤', label: 'Vos subís esos archivos aquí', desc: 'Una vez por mes, desde la pantalla de Carga, arrastrás los PDFs y CSVs a la app.' },
                            { n: '3', icon: '🔍', label: 'La app lee y organiza', desc: 'El sistema interpreta los números automáticamente y los clasifica (ventas, compras, sueldos).' }, 
                            { n: '4', icon: '☁️', label: 'Se guarda en Google Sheets', desc: 'Todo queda en una planilla privada tuya en Google Drive, con historial acumulado de meses.' },
                            { n: '5', icon: '📊', label: 'El Dashboard te muestra el resultado', desc: 'En segundos ves si ganaste o perdiste, cuánto, y por qué.' },
                        ].map(step => (
                            <div key={step.n} style={{ // Usar variables del tema
                                background: colors.bgCard, border: `1px solid ${colors.borderCard}`, 
                                borderRadius: 16, padding: '20px 18px',
                                display: 'flex', flexDirection: 'column', gap: 12 
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <StepBadge n={step.n} />
                                    <span style={{ fontSize: 20 }}>{step.icon}</span>
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 800, color: colors.textPrimary }}>{step.label}</span> {/* Usar variable del tema */}
                                <p style={{ fontSize: 11.5, color: colors.textMuted, lineHeight: 1.7, margin: 0 }}>{step.desc}</p>
                            </div>
                        ))}
                    </div>

                    {/* Qué NO hace la app */}
                    <div style={{
                        borderRadius: 16, padding: '20px 24px',
                        background: `${colors.red}08`, border: `1px solid ${colors.red}18`
                    }}>
                        <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.2em', color: '#f43f5e', textTransform: 'uppercase', marginBottom: 12 }}>
                            Qué NO hace esta app
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            {[
                                '❌ No reemplaza a tu contador', 
                                '❌ No presenta balances oficiales',
                                '❌ No hace declaraciones de impuestos',
                                '❌ No controla stock físico',
                            ].map((item, i) => (
                                <p key={i} style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>{item}</p>
                            ))} {/* Este color #94a3b8 se mapea a textMuted */}
                        </div>
                        <div style={{ marginTop: 12 }}> 
                            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                                Esta es una <Highlight>herramienta de gestión interna</Highlight>: te ayuda a saber si el negocio va bien o mal, mes a mes, sin esperar el balance de tu contador. Los números que muestra son para toma de decisiones operativas — <Highlight>no reemplazan estados contables oficiales ni declaraciones impositivas</Highlight>.
                            </p>
                        </div>
                    </div>

                    {/* La arquitectura */}
                    <div style={{ background: colors.bgCard, border: `1px solid ${colors.borderCard}`, borderRadius: 16, padding: '20px 24px' }}> {/* Usar variables del tema */}
                        <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.2em', color: colors.textFaint, textTransform: 'uppercase', marginBottom: 16 }}>
                            Dónde viven tus datos
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'center' }}>
                            <div style={{ textAlign: 'center', padding: 16, background: 'rgba(16,185,129,0.05)', borderRadius: 12, border: '1px solid rgba(16,185,129,0.15)' }}>
                                <div style={{ fontSize: 24, marginBottom: 8 }}>🖥️</div>
                                <p style={{ fontSize: 11, fontWeight: 800, color: '#10b981', margin: '0 0 4px' }}>Esta app (Frontend)</p>
                                <p style={{ fontSize: 10, color: colors.textFaint, margin: 0 }}>Lee archivos, muestra gráficos, envía datos</p>
                            </div>
                            <div style={{ textAlign: 'center', color: '#334155', fontSize: 20 }}>⇄</div>
                            <div style={{ textAlign: 'center', padding: 16, background: 'rgba(59,130,246,0.05)', borderRadius: 12, border: '1px solid rgba(59,130,246,0.15)' }}>
                                <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
                                <p style={{ fontSize: 11, fontWeight: 800, color: '#3b82f6', margin: '0 0 4px' }}>Google Sheets (Backend)</p>
                                <p style={{ fontSize: 10, color: colors.textFaint, margin: 0 }}>Almacena y procesa tus datos de forma segura</p>
                            </div>
                        </div>
                        <Tip>Tus datos quedan en una planilla de tu cuenta de Google, no en ningún servidor externo. Solo vos (y quien vos invites) puede verlos.</Tip>
                    </div>
                </div>
            )}

            {/* ─── FUENTES ─── */}
            {activeSection === 'fuentes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <SectionTitle icon="📂" title="Tus fuentes de datos" subtitle="Qué es cada archivo, de dónde lo sacás y qué información aporta." />

                    <Accordion icon="🧾" title="Maxirest PDF — Resumen Mensual de Ventas" defaultOpen>
                        <p><Highlight>¿Qué es Maxirest?</Highlight> Es el sistema de punto de venta (caja) que procesa cada venta de tu local.</p>
                        <p style={{ marginTop: 10 }}><Highlight>¿Qué contiene este PDF?</Highlight> Un resumen de todo lo que vendiste en el mes: el total facturado, cuántas operaciones, cómo pagaron los clientes (efectivo, tarjeta, otros medios), y cuánto vendiste en cada turno.</p>
                        <p style={{ marginTop: 10 }}><Highlight>¿Dónde lo descargo?</Highlight></p>
                        <ol style={{ margin: '8px 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <li>Entrá a Maxirest → sección <em>Reportes</em></li>
                            <li>Buscá el reporte <em>Resumen de Ventas</em> o <em>Cierre Z Mensual</em></li>
                            <li>Elegí el mes que querés y exportá como PDF</li>
                        </ol>
                        <p style={{ marginTop: 10 }}><Highlight>¿Qué hace la app con él?</Highlight> Extrae automáticamente el total de ventas, el IVA, el efectivo, las tarjetas y el total de operaciones. Esos datos alimentan el Dashboard principal.</p>
                        <Tip>Si el PDF tiene un total ligeramente distinto al calculado por la app, es normal. La app usa los valores fiscales (Neto + IVA de Factura B Electrónica) que son los que realmente importan para el P&L.</Tip>
                    </Accordion>

                    <Accordion icon="🏛️" title="ARCA CSV — Mis Comprobantes Recibidos (AFIP)">
                        <p><Highlight>¿Qué es ARCA?</Highlight> Es el portal web de AFIP (ahora renombrado ARCA) donde se registran todas las facturas que te emiten tus proveedores.</p>
                        <p style={{ marginTop: 10 }}><Highlight>¿Qué contiene este CSV?</Highlight> La lista de todas las facturas de compra: quién te facturó, cuánto, qué impuestos tiene, y cuándo fue.</p>
                        <p style={{ marginTop: 10 }}><Highlight>¿Dónde lo descargo?</Highlight></p>
                        <ol style={{ margin: '8px 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <li>Ingresá a <strong>arca.gob.ar</strong> con tu CUIT y clave fiscal</li>
                            <li>Ir a <em>Mis Comprobantes → Recibidos</em></li>
                            <li>Filtrá por el mes que necesitás</li>
                            <li>Hacé clic en <em>Exportar → CSV</em></li>
                        </ol>
                        <p style={{ marginTop: 10 }}><Highlight>¿Para qué sirve?</Highlight> Cada factura que cargás es un egreso (gasto) del negocio. La app los resta a las ventas para calcular la ganancia, y usa el IVA de esas facturas para calcular tu posición fiscal.</p>
                        <p style={{ marginTop: 14 }}><Highlight>¿Qué pestañas veo cuando abro la sección ARCA?</Highlight></p>
                        <div style={{ margin: '10px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ background: colors.bgSurface, borderRadius: 10, padding: '10px 14px', border: `1px solid ${colors.borderSubtle}` }}>
                                <p style={{ margin: 0, fontWeight: 800, color: colors.textSecondary }}>📄 Facturas con IVA</p>
                                <p style={{ margin: '4px 0 0', color: colors.textMuted }}>Son las <strong>Facturas A</strong>: te las emite un proveedor que está inscripto en IVA. El IVA de estas facturas se descuenta de lo que le debés a AFIP (es tu crédito fiscal).</p>
                            </div>
                            <div style={{ background: colors.bgSurface, borderRadius: 10, padding: '10px 14px', border: `1px solid ${colors.borderSubtle}` }}>
                                <p style={{ margin: 0, fontWeight: 800, color: colors.textSecondary }}>📋 Otros gastos</p>
                                <p style={{ margin: '4px 0 0', color: colors.textMuted }}>Facturas B, C y otros tipos. Son compras válidas que suman al gasto total, pero el IVA ya está incluido en el precio y no se puede desglosar para descontar de AFIP.</p>
                            </div>
                            <div style={{ background: colors.bgSurface, borderRadius: 10, padding: '10px 14px', border: `1px solid ${colors.borderSubtle}` }}>
                                <p style={{ margin: 0, fontWeight: 800, color: '#fda4af' }}>↩️ Devoluciones (en rojo)</p>
                                <p style={{ margin: '4px 0 0', color: colors.textMuted }}>Son <strong>Notas de Crédito</strong>: el proveedor te devolvió dinero o corrigió una factura anterior. Aparecen en rojo porque reducen el total que gastaste con ese proveedor ese mes.</p>
                            </div>
                            <div style={{ background: colors.bgSurface, borderRadius: 10, padding: '10px 14px', border: `1px solid ${colors.borderSubtle}` }}>
                                <p style={{ margin: 0, fontWeight: 800, color: colors.textSecondary }}>🏢 Proveedores</p>
                                <p style={{ margin: '4px 0 0', color: colors.textMuted }}>Un resumen de cuánto le compraste a cada proveedor en el mes. Acá también podés asignarle un alias (nombre fácil) a cada uno para que aparezca mejor en los reportes.</p>
                            </div>
                        </div>
                        <Warning>Si un proveedor tiene un nombre raro o genérico (ej: "Distribuidora del Sur SA"), puede que no se clasifique correctamente. Desde la pestaña <strong>Proveedores</strong> podés asignarle un alias y una categoría.</Warning>
                    </Accordion>

                    <Accordion icon="👥" title="Planilla de Sueldos CSV — Nómina del mes">
                        <p><Highlight>¿Qué es esto?</Highlight> Un archivo de Excel/CSV con la lista de tus empleados y lo que le pagaste a cada uno en el mes.</p>
                        <p style={{ marginTop: 10 }}><Highlight>¿Qué columnas necesita?</Highlight> La app espera estas columnas en orden:</p>
                        <div style={{ margin: '10px 0', background: colors.bgSurface, border: `1px solid ${colors.borderSubtle}`, borderRadius: 10, padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: colors.textMuted, lineHeight: 2 }}>
                            Legajo | Nombre | Tarea | — | DNI | — | — | — | — | Horas | — | Costo Total | Recibo | — | Negro
                        </div> {/* Este color #94a3b8 se mapea a textMuted */}
                        <p style={{ marginTop: 4, fontSize: 11, color: '#475569' }}>Las columnas vacías (—) pueden quedar en cero. El campo <em>Costo Total</em> es el más importante: es lo que salió del local por cada empleado ese mes, incluyendo cargas sociales.</p>
                        <Tip>Si ya tenés tu planilla en otro formato, podés exportar desde Excel a CSV y editar las columnas para que coincidan. El equipo puede ayudarte a adaptar el formato.</Tip>
                    </Accordion>

                    <Accordion icon="" title="Retenciones — IVA y Ganancias">
                        <p><Highlight>¿Qué son las retenciones?</Highlight> Es dinero que el Estado te cobra "por adelantado" a través de los bancos o aplicaciones al momento de cobrar con tarjeta o QR.</p>
                        <p style={{ marginTop: 10 }}><Highlight>¿Para qué sirven en la app?</Highlight> Al cargarlas, el sistema las resta de tu Posición de IVA, mostrándote el monto real que tendrías que pagar en el VEP.</p>
                        <p style={{ marginTop: 10 }}><Highlight>¿Dónde las veo?</Highlight> Una vez cargadas, podés ver el detalle en la sección <strong>Datos → Retenciones</strong>.</p>
                        <Tip>Las retenciones no son un gasto, sino un pago a cuenta de impuestos.</Tip>
                    </Accordion>

                    <Accordion icon="🏦" title="Honorarios — Contador, Abogado, Asesor">
                        <p><Highlight>¿Qué es esto?</Highlight> Cualquier pago a un profesional que te presta servicios al local pero que no tiene un archivo para importar.</p>
                        <p style={{ marginTop: 10 }}>Ejemplos: tu contador, un abogado, un asesor impositivo.</p>
                        <p style={{ marginTop: 10 }}><Highlight>¿Cómo lo cargo?</Highlight> Desde la pantalla de Carga, hacé clic en el botón <em>Gastos Fijos</em> o agregalo como un movimiento manual.</p>
                    </Accordion>

                    <Accordion icon="🏢" title="Costos Estructurales — Alquiler, Luz, Gas, Expensas">
                        <p><Highlight>¿Qué es esto?</Highlight> Los gastos fijos del local que pagás todos los meses sin importar si vendiste mucho o poco.</p>
                        <p style={{ marginTop: 10 }}>Ejemplos: alquiler del local, factura de luz eléctrica, gas, expensas del edificio, servicio de internet.</p>
                        <p style={{ marginTop: 10 }}><Highlight>¿Cómo lo cargo?</Highlight> Hacé clic en <em>Costos Estructurales</em> desde la pantalla de Carga e ingresá cada monto. Podés agregar varios alquileres si tenés más de un local.</p>
                        <Tip>Si estos gastos ya vienen en el CSV de ARCA (porque el dueño del inmueble te factura), <strong>no los cargues de nuevo acá</strong>, ya estarían contados.</Tip>
                    </Accordion>

                    <Accordion icon="📋" title="Ingresos Brutos — Impuesto Provincial">
                        <p><Highlight>¿Qué es Ingresos Brutos?</Highlight> Es un impuesto que cobra la provincia sobre todo lo que vendés. Se paga mensualmente y es un porcentaje de las ventas totales.</p>
                        <p style={{ marginTop: 10 }}>La alícuota (el porcentaje) varía según la actividad y la provincia. Para gastronomía en Buenos Aires, suele estar entre el 3% y el 5%.</p>
                        <p style={{ marginTop: 10 }}><Highlight>¿Cómo lo cargo?</Highlight> Hacé clic en <em>Ingresos Brutos</em> desde la pantalla de Carga. Podés separar IIBB Local del Convenio Multilateral si pagás en más de una jurisdicción.</p>
                        <Warning>Recordá configurar tu alícuota real en la pestaña de <strong>Ajustes</strong> para que las proyecciones sean exactas.</Warning>
                    </Accordion>
                </div>
            )}

            {/* ─── KPIs ─── */}
            {activeSection === 'kpis' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <SectionTitle icon="📈" title="Tus indicadores del Dashboard" subtitle="Qué significa cada número y cómo leerlo para tomar decisiones." />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <KpiPill
                            label="Resultado del Período"
                            color="#10b981"
                            value="Ganancia / Pérdida"
                            desc="Es el número más importante. Dice cuánto dinero entró al negocio después de pagar absolutamente todo: mercadería, sueldos, alquiler, impuestos, comisiones. Si es verde, ganaste. Si es rojo, perdiste."
                        />
                        <KpiPill
                            label="Margen Bruto"
                            color="#3b82f6"
                            value="% de cada venta que queda"
                            desc="De cada $100 que vendés, ¿cuántos quedan después de pagar la mercadería y las comisiones bancarias? Para una cafetería sana, debería estar entre el 55% y el 70%. Por debajo del 50% es una señal de alerta."
                        />
                        <KpiPill
                            label="Punto de Equilibrio"
                            color="#f59e0b"
                            value="¿Cuánto necesitás vender para no perder?"
                            desc="Es el monto de ventas mínimo que necesitás en el mes para que el resultado sea exactamente $0. Superar ese número es empezar a ganar dinero real."
                        />
                        <KpiPill
                            label="Posición IVA"
                            color="#64748b"
                            value="Lo que debés (o te deben) de IVA"
                            desc="IVA cobrado a tus clientes menos IVA pagado en tus compras con factura. Si el número es positivo (rojo) → le debés ese monto a AFIP. Si es negativo (verde) → AFIP te debe a vos y tenés saldo a favor para el mes siguiente."
                        />
                        <KpiPill
                            label="Ventas Netas"
                            color="#10b981"
                            value="Ventas sin IVA y sin comisiones"
                            desc="Es el ingreso real que genera el negocio, sin el IVA que le pertenece al Estado y sin los recargos que se llevan los bancos y las apps de delivery."
                        />
                        <KpiPill
                            label="CMV (Costo Mercadería)"
                            color="#f59e0b"
                            value="Lo que pagás para vender"
                            desc="Costo de insumos. El sistema lo detecta automáticamente por el nombre del proveedor. Podés ajustar qué palabras clave disparan esta categoría en la sección de Ajustes."
                        />
                        <KpiPill
                            label="Costo Laboral"
                            color="#8b5cf6"
                            value="Total que salió por empleados"
                            desc="Suma de sueldos + provisión de SAC + cargas sociales. El porcentaje de cargas sociales (ej: 33%) es configurable desde la pestaña de Ajustes."
                        />
                        <KpiPill
                            label="Ticket Promedio"
                            color="#06b6d4"
                            value="Cuánto gasta cada cliente"
                            desc="El promedio de cada transacción de venta. Subir este número (con combos, sugerencias, productos de mayor valor) es una de las palancas más efectivas para mejorar la rentabilidad."
                        />
                    </div>

                    {/* Modos de vista */}
                    <div style={{ background: colors.bgCard, border: `1px solid ${colors.borderCard}`, borderRadius: 16, padding: '20px 24px' }}> {/* Usar variables del tema */}
                        <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.2em', color: '#475569', textTransform: 'uppercase', marginBottom: 16 }}>
                            Los 3 modos de visualización
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                                <Tag color="#94a3b8">NOMINAL</Tag>
                                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.7 }}>
                                    Los pesos tal como están. Útil para el mes actual. <Highlight>Usá este modo para el día a día.</Highlight>
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                                <Tag color="#f59e0b">REAL IPC</Tag>
                                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.7 }}>
                                    Los valores históricos se ajustan por inflación, como si fueran pesos de hoy. Sirve para comparar meses pasados de forma justa. <Highlight>Usá este modo para ver si realmente creciste o solo acompañaste la inflación.</Highlight>
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                                <Tag color="#8b5cf6">DÓLAR MEP</Tag> {/* Mantener color semántico */}
                                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.7 }}>
                                    Todos los valores convertidos a dólares MEP. <Highlight>Usá este modo para saber si tu negocio es rentable en términos dolarizados</Highlight> — útil si tus costos (alquiler, insumos) están parcialmente en dólares.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── GLOSARIO ─── */}
            {activeSection === 'glosario' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <SectionTitle icon="📖" title="Glosario financiero" subtitle="Las palabras que vas a ver en la app, explicadas en simple." />

                    {[
                        { term: 'EGRESO', color: '#f43f5e', def: 'Cualquier dinero que sale del negocio. Compras, sueldos, alquiler, impuestos. Todo lo que pagás.' },
                        { term: 'INGRESO', color: '#10b981', def: 'Dinero que entra al negocio por ventas. No confundir con "ganancia" — el ingreso es bruto, todavía no descontaste los gastos.' },
                        { term: 'IVA (Impuesto al Valor Agregado)', color: '#64748b', def: 'Impuesto que está incluido en el precio de cada venta y de cada compra. Existen varias tasas: 21% para la mayoría de servicios, 10.5% para alimentos básicos y algunos insumos gastronómicos, 27% para servicios como electricidad, y 0% para artículos exentos. El IVA que cobrás no es tuyo: lo recaudás por cuenta del Estado y luego lo liquidás.' },
                        { term: 'Débito Fiscal', color: '#f43f5e', def: 'El IVA que le cobraste a tus clientes en tus ventas del mes. Este monto se lo debés a AFIP.' },
                        { term: 'Crédito Fiscal', color: '#10b981', def: 'El IVA que vos pagaste al comprar a tus proveedores. Se descuenta del débito fiscal: si compraste mucho ese mes, pagás menos IVA a AFIP.' },
                        { term: 'Factura A', color: '#3b82f6', def: 'La emite un proveedor inscripto en IVA hacia otro responsable inscripto. Muestra el precio sin IVA y el IVA por separado. El IVA de una Factura A es crédito fiscal: lo podés descontar de lo que le debés a AFIP.' },
                        { term: 'Factura B / C', color: '#64748b', def: 'La emite un proveedor hacia un consumidor final o monotributista. El IVA está incluido en el precio y no se puede desglosar. Sirve como gasto del negocio, pero no genera crédito fiscal descontable.' },
                        { term: 'Nota de Crédito', color: '#f43f5e', def: 'Documento que emite un proveedor para anular o corregir una factura anterior. En la app aparece en rojo en la pestaña "Devoluciones": reduce el total gastado con ese proveedor ese mes.' },
                        { term: 'CMV (Costo de Mercadería Vendida)', color: '#f59e0b', def: 'Lo que te costó producir o comprar aquello que vendiste. En una cafetería: el café, la leche, el pan, los insumos de cocina.' },
                        { term: 'Margen Bruto', color: '#3b82f6', def: 'Lo que te queda de las ventas después de pagar la mercadería. Antes de pagar sueldos, alquiler o impuestos.' },
                        { term: 'Margen Neto (Resultado)', color: '#3b82f6', def: 'Lo que realmente te queda después de pagar absolutamente todo. Es el número final.' },
                        { term: 'Break-even / Punto de Equilibrio', color: '#f59e0b', def: 'El mínimo de ventas para no perder dinero. Por debajo de ese número, el negocio está perdiendo.' },
                        { term: 'IIBB / Ingresos Brutos', color: '#f97316', def: 'Impuesto provincial sobre las ventas. Lo cobra la Provincia, no AFIP. Se paga mensualmente.' },
                        { term: 'Nómina', color: '#8b5cf6', def: 'La lista de empleados y sus salarios. En finanzas, el "costo de nómina" incluye no solo el sueldo de bolsillo sino también las cargas sociales que paga el empleador.' },
                        { term: 'Cargas Sociales', color: '#8b5cf6', def: 'Los aportes patronales que pagás al Estado por cada empleado. Se calculan como un porcentaje del sueldo bruto (configurable en Ajustes).' },
                        { term: 'Comisión Bancaria', color: '#f43f5e', def: 'El porcentaje que se queda el banco o la app por procesar el pago. Se aplica sobre las ventas cobradas por tarjeta u otros medios según lo definas en Ajustes.' },
                        { term: 'Período Fiscal', color: '#64748b', def: 'El mes al que corresponde cada operación. Por ejemplo "2026-03" = marzo de 2026.' },
                        { term: 'Devengado vs Percibido', color: '#64748b', def: 'Devengado = cuando se generó la obligación (cuando vendiste). Percibido = cuando entró el dinero. Esta app trabaja en modo devengado: las ventas de tarjeta se cuentan cuando se hicieron, aunque el dinero llegue días después.' },
                        { term: 'IPC', color: '#f59e0b', def: 'Índice de Precios al Consumidor. Mide la inflación mensual. Lo usamos para ajustar los valores históricos y poder comparar meses de forma justa.' },
                        { term: 'MEP (Dólar MEP)', color: '#8b5cf6', def: 'Un tipo de cambio dólar determinado por el mercado de bonos, generalmente más representativo de la economía real que el dólar oficial.' },
                    ].map((item, i) => (
                        <div key={i} style={{
                            display: 'flex', gap: 16, alignItems: 'flex-start',
                            padding: '14px 18px', borderRadius: 12,
                            background: colors.bgCard, border: `1px solid ${colors.borderCard}` // Usar variables del tema
                        }}>
                            <span style={{
                                fontSize: 10, fontWeight: 900, color: item.color,
                                background: `${item.color}12`, border: `1px solid ${item.color}25`,
                                padding: '4px 10px', borderRadius: 6, flexShrink: 0,
                                letterSpacing: '0.05em', whiteSpace: 'nowrap', marginTop: 2
                            }}>{item.term}</span>
                            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.75 }}>{item.def}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* ─── CHECKLIST ─── */}
            {activeSection === 'checklist' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <SectionTitle icon="✅" title="Tu lista de tareas mensual" subtitle="Lo que tenés que hacer cada mes, en orden, para tener el Dashboard al día." />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

                        {/* Semana 1 */}
                        <div style={{ background: colors.bgCard, border: `1px solid ${colors.borderCard}`, borderRadius: 16, padding: '20px 22px' }}>
                            <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.2em', color: '#10b981', textTransform: 'uppercase', marginBottom: 16 }}>
                                🟢 Al cierre del mes (1-5 del mes siguiente)
                            </p>
                            {[
                                { done: false, text: 'Descargar el PDF de Maxirest (Resumen Mensual de Ventas)' },
                                { done: false, text: 'Subirlo desde la pantalla de Carga → Maxirest PDF' },
                                { done: false, text: 'Verificar la fecha y el total en la previsualización' },
                                { done: false, text: 'Confirmar y guardar' },
                            ].map((item, i) => (
                                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                                    <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>
                                        {item.done ? '✅' : '⬜'}
                                    </span>
                                    <span style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.6 }}>{item.text}</span>
                                </div>
                            ))}
                        </div>

                        {/* ARCA */}
                        <div style={{ background: colors.bgCard, border: `1px solid ${colors.borderCard}`, borderRadius: 16, padding: '20px 22px' }}>
                            <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.2em', color: '#3b82f6', textTransform: 'uppercase', marginBottom: 16 }}>
                                🔵 Compras (ARCA/AFIP)
                            </p>
                            {[
                                { text: 'Ingresar a arca.gob.ar con tu clave fiscal' },
                                { text: 'Ir a Mis Comprobantes → Recibidos → filtrar por el mes' },
                                { text: 'Exportar como CSV' },
                                { text: 'Subir desde la pantalla de Carga → ARCA CSV' },
                                { text: 'Revisar que los proveedores importantes estén bien categorizados' },
                            ].map((item, i) => (
                                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                                    <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>⬜</span>
                                    <span style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.6 }}>{item.text}</span>
                                </div>
                            ))}
                        </div>

                        {/* Sueldos + Manuales */}
                        <div style={{ background: colors.bgCard, border: `1px solid ${colors.borderCard}`, borderRadius: 16, padding: '20px 22px' }}>
                            <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.2em', color: '#8b5cf6', textTransform: 'uppercase', marginBottom: 16 }}>
                                🟣 Sueldos y gastos manuales
                            </p>
                            {[
                                { text: 'Subir la planilla CSV de sueldos del mes (Planilla Sueldos)' },
                                { text: 'Cargar el alquiler y los servicios (si no vienen por ARCA)' },
                                { text: 'Cargar las retenciones de tarjetas y apps del mes' },
                                { text: 'Cargar el pago de Ingresos Brutos del mes' },
                                { text: 'Cargar honorarios del contador u otros profesionales' },
                            ].map((item, i) => (
                                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                                    <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>⬜</span>
                                    <span style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.6 }}>{item.text}</span>
                                </div>
                            ))}
                        </div>

                        {/* Dashboard */}
                        <div style={{ background: colors.bgCard, border: `1px solid ${colors.borderCard}`, borderRadius: 16, padding: '20px 22px' }}>
                            <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.2em', color: '#f59e0b', textTransform: 'uppercase', marginBottom: 16 }}>
                                🟡 Revisar el Dashboard
                            </p>
                            {[
                                { text: 'Ir a Análisis de Resultados → Dashboard' },
                                { text: 'Seleccionar el mes que cargaste' },
                                { text: 'Verificar que el Resultado sea razonable (no exageradamente alto ni bajo)' },
                                { text: 'Revisar la Composición de Egresos: ¿está todo bien clasificado?' },
                                { text: 'Anotar si superaste el Punto de Equilibrio' },
                                { text: 'Revisar la Posición IVA: si es positiva (roja), ese monto hay que pagarlo a AFIP' },
                                { text: 'Actualizar el coeficiente IPC si querés comparar en términos reales' },
                            ].map((item, i) => (
                                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                                    <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>⬜</span>
                                    <span style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.6 }}>{item.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Señales de alerta */}
                    <div style={{ background: colors.bgCard, border: `1px solid ${colors.red}25`, borderRadius: 16, padding: '20px 24px' }}>
                        <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.2em', color: '#f43f5e', textTransform: 'uppercase', marginBottom: 16 }}>
                            🔴 Señales de alerta — cuándo preocuparse
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {[
                                { signal: 'Margen bruto < 50%', action: 'Revisá tus precios o el costo de tus recetas.' },
                                { signal: 'CMV > 40% de ventas', action: 'Demasiado gasto en mercadería. Revisá merma o precios de proveedores.' },
                                { signal: 'Resultado negativo 2 meses seguidos', action: 'Señal crítica. Llamá a tu contador.' },
                                { signal: 'No alcanzás el break-even', action: 'Las ventas no alcanzan para cubrir los costos fijos.' },
                                { signal: 'Costo laboral > 35% de ventas', action: 'Exceso de personal o sueldos altos para el nivel de ventas.' },
                                { signal: 'Posición IVA positiva muy alta', action: 'Significa que cobraste mucho IVA pero tenés pocas facturas de compras. Revisá que hayas subido el CSV de ARCA con todas las facturas del mes.' },
                            ].map((item, i) => (
                                <div key={i} style={{ // Usar variables del tema
                                    background: `${colors.red}08`, borderRadius: 10, padding: '12px 14px',
                                    border: `1px solid ${colors.red}12`
                                }}> 
                                    <p style={{ fontSize: 11, fontWeight: 800, color: '#fda4af', margin: '0 0 4px' }}>⚠️ {item.signal}</p>
                                    <p style={{ fontSize: 11, color: colors.textMuted, margin: 0, lineHeight: 1.6 }}>{item.action}</p> {/* Usar variable del tema */}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GuideView;
