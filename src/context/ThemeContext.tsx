import React, { createContext, useContext, useEffect, useState } from 'react';
import { applyThemeMode, resolveThemeMode, type ThemeMode } from '../lib/themeMode';

// Types
type Theme = ThemeMode;

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<Theme>(() => {
        return resolveThemeMode();
    });

    useEffect(() => {
        applyThemeMode(theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === 'midnight' ? 'dawn' : 'midnight'));
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
