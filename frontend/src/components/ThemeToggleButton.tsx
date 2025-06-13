import React from 'react';
import { IconButton } from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { useThemeContext } from '../ThemeContext'; // Make sure the path is correct

export default function ThemeToggleButton() {
    const { mode, toggleTheme } = useThemeContext();

    return (
        <IconButton title="Toggle theme" sx={{ color: 'primary' }} onClick={toggleTheme}>
            {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
        </IconButton>
    );
};