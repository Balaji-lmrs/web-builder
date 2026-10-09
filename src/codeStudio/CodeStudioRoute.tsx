import { useParams } from 'react-router-dom';
import CodeStudioPage from '../codeStudio/CodeStudio';
import { Shell } from '../app/Shell';

export function CodeEditor(){const {projectId}=useParams();return <Shell><CodeStudioPage projectId={projectId}/></Shell>}
