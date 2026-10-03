export type SectionKind = 'nav' | 'hero' | 'products' | 'features' | 'testimonial' | 'footer' | 'custom';
export type Section = { id: string; kind: SectionKind; title: string; text: string; accent?: string };
export type Project = { id: string; name: string; templateId: string; updatedAt: string; updatedAtMs?: number; lastAction?: string; published: boolean; sections: Section[] };
export type Template = { id: string; name: string; category: string; style: string; description: string; color: string; tags: string[]; sections: Section[] };
