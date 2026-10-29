import PublicIntro from '../../../components/PublicIntro';
export default async function IntroPage({params}:{params:Promise<{id:string}>}){return <PublicIntro id={(await params).id}/>;}
