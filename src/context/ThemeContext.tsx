import React, { createContext, useContext, useEffect, useState } from 'react';

// Types
type Theme = 'night' | 'dawn';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<Theme>(() => {
        const stored = localStorage.getItem('180_theme');
        return (stored as Theme) || 'night';
    });

    useEffect(() => {
        const body = document.body;
        if (theme === 'dawn') {
            body.classList.add('light-mode');
        } else {
            body.classList.remove('light-mode');
        }
        localStorage.setItem('180_theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'night' ? 'dawn' : 'night');
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
