import Studio from '../../../../components/Studio';
export default async function ProjectPage({params}:{params:Promise<{id:string}>}){return <Studio projectId={(await params).id}/>;}
