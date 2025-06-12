import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { Box, CircularProgress } from '@mui/material';

interface LazyLoadSectionProps {
    onIntersect: () => void;
    children: ReactNode;
    placeholderHeight?: string | number;
    rootMargin?: string;
}

const LazyLoadSection: React.FC<LazyLoadSectionProps> = ({
    onIntersect,
    children,
    placeholderHeight = '200px',
    rootMargin = '0px 0px 200px 0px',
}) => {
    const [isIntersected, setIsIntersected] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const currentRef = ref.current;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !isIntersected) {
                    setIsIntersected(true);
                    onIntersect();
                    if (currentRef) {
                        observer.unobserve(currentRef);
                    }
                }
            },
            {
                rootMargin: rootMargin,
                threshold: 0.01,
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