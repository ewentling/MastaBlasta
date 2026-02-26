import { useState, useEffect } from 'react';
import { ExternalLink, ChevronRight, ChevronLeft, Check } from 'lucide-react';

interface Step {
    title: string;
    desc: string;
    link?: string | null;
    linkLabel?: string | null;
}

interface SetupWizardProps {
    steps: Step[];
    platformName: string;
}

export default function SetupWizard({ steps, platformName }: SetupWizardProps) {
    const [currentStep, setCurrentStep] = useState(0);

    const nextStep = () => {
        if (currentStep < steps.length - 1) setCurrentStep(c => c + 1);
    };

    const prevStep = () => {
        if (currentStep > 0) setCurrentStep(c => c - 1);
    };

    const step = steps[currentStep];

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') nextStep();
            if (e.key === 'ArrowLeft') prevStep();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [currentStep, steps.length]);

    if (!steps || steps.length === 0) {
        return <div className="text-sm text-slate-400">No setup instructions available for {platformName}.</div>;
    }

    return (
        <div className="flex flex-col h-full min-h-[300px]">
            <div className="flex-1 flex flex-col justify-center py-4 px-2">
                <div className="flex items-start gap-4 mb-4">
                    <span
                        className="flex-shrink-0 w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center text-white mt-1 transition-all duration-300"
                        style={currentStep === steps.length - 1
                            ? { background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 0 12px rgba(16,185,129,0.4)' }
                            : { background: 'linear-gradient(135deg, #00e5ff 0%, #7c4dff 100%)', boxShadow: '0 0 10px rgba(0, 229, 255, 0.3)' }
                        }
                    >
                        {currentStep + 1}
                    </span>
                    <div>
                        <h4 className="text-lg font-semibold text-slate-100 mb-2">{step.title}</h4>
                        <p className="text-sm text-slate-400 leading-relaxed mb-6 whitespace-pre-line">
                            {step.desc}
                        </p>
                    </div>
                </div>

                {step.link && (
                    <div className="ml-12">
                        <a
                            href={step.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-cyan-400 hover:text-cyan-300 w-fit px-4 py-2 rounded-lg transition-colors"
                            style={{ background: 'rgba(0, 229, 255, 0.05)', border: '1px solid rgba(0, 229, 255, 0.2)' }}
                        >
                            {step.linkLabel || 'Open Link'}<ExternalLink className="w-4 h-4" />
                        </a>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between mt-auto pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <div className="flex gap-1.5">
                    {steps.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1.5 rounded-full transition-all duration-300 ${i === currentStep ? 'w-6 bg-cyan-400' : i < currentStep ? 'w-1.5 bg-emerald-400' : 'w-1.5 bg-slate-700'}`}
                        />
                    ))}
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={prevStep}
                        disabled={currentStep === 0}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-600 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors flex items-center"
                    >
                        <ChevronLeft className="w-4 h-4 mr-1" /> Back
                    </button>
                    <button
                        onClick={nextStep}
                        disabled={currentStep === steps.length - 1}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center"
                        style={{ background: currentStep === steps.length - 1 ? 'rgba(52, 211, 153, 0.2)' : 'rgba(255, 255, 255, 0.1)' }}
                    >
                        {currentStep === steps.length - 1 ? (
                            <><Check className="w-4 h-4 mr-1 text-emerald-400" /> <span className="text-emerald-400 border-none">Done</span></>
                        ) : (
                            <>Next <ChevronRight className="w-4 h-4 ml-1" /></>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
