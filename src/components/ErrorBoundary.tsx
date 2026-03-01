import { Component, type ErrorInfo, type ReactNode } from 'react';
import {
    LANGUAGE_STORAGE_KEY,
    PRIMARY_LANGUAGE,
    isLanguageCode,
    type LanguageCode
} from '../i18n/localization';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

const ERROR_BOUNDARY_COPY: Record<LanguageCode, { title: string; body: string; reset: string }> = {
    en: {
        title: 'Something went wrong.',
        body: 'The ritual was interrupted. Please try refreshing the page or clearing your local data.',
        reset: 'Clear Data and Restart'
    },
    tr: {
        title: 'Bir şeyler ters gitti.',
        body: 'Ritüel kesintiye uğradı. Sayfayı yenilemeyi veya yerel verilerini temizlemeyi dene.',
        reset: 'Veriyi Temizle ve Yeniden Başlat'
    },
    es: {
        title: 'Algo salio mal.',
        body: 'El ritual se interrumpio. Intenta recargar la pagina o borrar tus datos locales.',
        reset: 'Borrar Datos y Reiniciar'
    },
    fr: {
        title: 'Un probleme est survenu.',
        body: 'Le rituel a ete interrompu. Essaie d actualiser la page ou d effacer tes donnees locales.',
        reset: 'Effacer les Donnees et Redemarrer'
    }
};

const getErrorBoundaryLanguage = (): LanguageCode => {
    if (typeof window === 'undefined') return PRIMARY_LANGUAGE;
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguageCode(storedLanguage) ? storedLanguage : PRIMARY_LANGUAGE;
};

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            const copy = ERROR_BOUNDARY_COPY[getErrorBoundaryLanguage()];
            return (
                <div className="min-h-screen bg-[#121212] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
                    <h1 className="text-4xl font-bold text-sage mb-4">{copy.title}</h1>
                    <p className="text-gray-400 mb-8 max-w-md">{copy.body}</p>

                    <div className="bg-black/30 p-4 rounded text-left overflow-auto max-w-2xl max-h-64 mb-8 border border-white/10">
                        <p className="text-red-400 font-mono text-xs">{this.state.error?.toString()}</p>
                    </div>

                    <button
                        onClick={() => {
                            localStorage.clear();
                            window.location.reload();
                        }}
                        className="px-6 py-2 bg-sage/20 text-sage border border-sage/50 rounded hover:bg-sage/30 transition-colors uppercase tracking-widest text-xs font-bold"
                    >
                        {copy.reset}
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
