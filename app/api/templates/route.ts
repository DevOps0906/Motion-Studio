import {templateCatalog} from '../../../lib/template-catalog';
export async function GET(){return Response.json(templateCatalog);}
