import { Routes, Route, Navigate } from 'react-router-dom';
import { Auth } from './Auth';
import { Dashboard } from '../pages/Dashboard/DashboardPage';
import { Websites } from '../pages/Projects/ProjectsPage';
import { Templates } from '../pages/Templates/TemplatesPage';
import { Components } from '../pages/Components/ComponentsPage';
import { Builder } from '../pages/Workspace/WorkspacePage';
import { SettingsPage } from '../pages/Settings/SettingsPage';
import { CartPage } from '../pages/Cart/CartPage';
import { Preview } from '../pages/Preview/PreviewPage';
import { CodeEditor } from '../codeStudio/CodeStudioRoute';

function App(){return <Routes><Route path="/" element={<Navigate to="/dashboard"/>}/><Route path="/login" element={<Auth/>}/><Route path="/signup" element={<Auth signup/>}/><Route path="/dashboard" element={<Dashboard/>}/><Route path="/websites" element={<Websites/>}/><Route path="/templates" element={<Templates/>}/><Route path="/components" element={<Components/>}/><Route path="/library" element={<Templates/>}/><Route path="/settings" element={<SettingsPage/>}/><Route path="/cart" element={<CartPage/>}/><Route path="/builder/:projectId" element={<Builder/>}/><Route path="/code/:projectId" element={<CodeEditor/>}/><Route path="/preview/:projectId" element={<Preview/>}/><Route path="*" element={<Navigate to="/dashboard"/>}/></Routes>}

export default App;
