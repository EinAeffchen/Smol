import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { Box, CircularProgress } from '@mui/material';

interface LazyLoadSectionProps {
    onIntersect: () => void;
    children: ReactNode;
    placeholderHeight?: string | number; // To prevent layout shift
    rootMargin?: string;
}

const LazyLoadSection: React.FC<LazyLoadSectionProps> = ({
    onIntersect,
    children,
    placeholderHeight = '200px', // Default placeholder height
    rootMargin = '0px 0px 200px 0px', // Trigger when 200px from bottom of viewport
}) => {
    const [isIntersected, setIsIntersected] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        // Ensure onIntersect is stable or wrap this effect's call in useCallback if onIntersect changes often
        const currentRef = ref.current;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !isIntersected) {
                    setIsIntersected(true);
                    onIntersect();
                    if (currentRef) { // Unobserve after triggering
                        observer.unobserve(currentRef);
                    }
                }
            },
            {
                rootMargin: rootMargin, // How close to viewport to trigger
                threshold: 0.01,       // As soon as 1% is visible
            }
        );

        if (currentRef) {
            observer.observe(currentRef);
        }

        return () => {
            if (currentRef) {
                observer.unobserve(currentRef);
            }
        };
    }, [onIntersect, isIntersected, rootMargin]);

    return (
        <Box ref={ref} minHeight={!isIntersected && placeholderHeight ? placeholderHeight : undefined}>
            {isIntersected ? children : <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}><CircularProgress size={24} /></Box>}
        </Box>
    );
};

export default LazyLoadSection;