import { Settings, CheckCircle2 } from 'lucide-react';
import { Shell } from '../../app/Shell';

export function SettingsPage(){return <Shell><section className="page pageTop"><p className="eyebrow">SYSTEM</p><h1>Settings</h1><div className="settings"><article><h3>Appearance</h3><p>Dark workspace theme is active.</p><button className="ghost">Dark mode <CheckCircle2 size={16}/></button></article><article><h3>Editor</h3><p>Autosave is enabled with a short debounce.</p><button className="ghost">Autosave on</button></article><article><h3>Publishing</h3><p>Connect a deployment provider to publish sites.</p><button className="ghost">Configure provider</button></article></div></section></Shell>}
