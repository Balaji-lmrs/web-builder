export type SectionKind = 'nav' | 'hero' | 'products' | 'features' | 'testimonial' | 'footer' | 'custom';
export type PublishedItem = { id: string; version: number; name: string; description: string; kind: string; category: string; entry: string; files: {path:string;content:string;binary?:boolean;directory?:boolean;mime?:string}[] };
export type Section = { id: string; kind: SectionKind; title: string; text: string; accent?: string; publishedItem?: PublishedItem };
export type Project = { id: string; name: string; templateId: string; updatedAt: string; updatedAtMs?: number; lastAction?: string; published: boolean; sections: Section[] };
export type Template = { id: string; name: string; category: string; style: string; description: string; color: string; tags: string[]; sections: Section[] };
