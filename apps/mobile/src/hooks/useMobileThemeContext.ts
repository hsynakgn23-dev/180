import { createContext, useContext } from 'react';
export const MobileThemeContext = createContext(false);
export const useMobileThemeContext = () => useContext(MobileThemeContext);
