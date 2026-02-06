import { useMemo, useState } from 'react';
import type { MarkDef } from '../../data/marksData';

interface MarkBadgeProps {
    mark: MarkDef;
    size?: number;
    iconClassName?: string;
    imageClassName?: string;
    alt?: string;
}

const BADGE_MODULES = import.meta.glob('../../assets/marks/*.{svg,png,jpg,jpeg,webp,avif}', {
    eager: true,
    import: 'default'
}) as Record<string, string>;

const BADGE_LOOKUP = Object.entries(BADGE_MODULES).reduce<Record<string, string>>((acc, [path, url]) => {
    const fileName = path.split('/').pop()?.toLowerCase();
    if (fileName) acc[fileName] = url;
    return acc;
}, {});

const EXTENSIONS = ['svg', 'png', 'jpg', 'jpeg', 'webp', 'avif'];

const resolveBadgeSrc = (mark: MarkDef): string | null => {
    const baseKey = (mark.badgeAsset || mark.id).trim().toLowerCase();
    if (!baseKey) return null;

    if (baseKey.includes('.')) {
        return BADGE_LOOKUP[baseKey] || null;
    }

    for (const ext of EXTENSIONS) {
        const found = BADGE_LOOKUP[`${baseKey}.${ext}`];
        if (found) return found;
    }

    return null;
};

export const MarkBadge: React.FC<MarkBadgeProps> = ({
    mark,
    size = 18,
    iconClassName = '',
    imageClassName = '',
    alt
}) => {
    const [fallbackToIcon, setFallbackToIcon] = useState(false);

    const badgeSrc = useMemo(() => {
        if (fallbackToIcon) return null;
        return resolveBadgeSrc(mark);
    }, [fallbackToIcon, mark]);

    if (badgeSrc) {
        return (
            <img
                src={badgeSrc}
                alt={alt || `${mark.title} badge`}
                loading="lazy"
                className={imageClassName}
                style={{ width: size, height: size }}
                onError={() => setFallbackToIcon(true)}
            />
        );
    }

    const Icon = mark.Icon;
    return <Icon size={size} className={iconClassName} />;
};

