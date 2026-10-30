import {motionPresets,renderResolutions,type MotionPresetId,type RenderResolutionId} from './motion-presets';
export type ProductionSettings={appTheme:'black'|'light';videoResolution:RenderResolutionId;videoPreset:MotionPresetId;websiteTheme:'dark'|'light';websiteAccent:string;blogStyle:'corporate'|'personal'|'magazine';blogAccent:string};
export const PRODUCTION_SETTINGS_KEY='motion-studio-production-settings-v1';
export const DEFAULT_PRODUCTION_SETTINGS:ProductionSettings={appTheme:'black',videoResolution:'1080p',videoPreset:'mosaic',websiteTheme:'dark',websiteAccent:'#c4b5fd',blogStyle:'corporate',blogAccent:'#c4b5fd'};
export function normalizeProductionSettings(input:unknown):ProductionSettings{
 const data=input&&typeof input==='object'&&!Array.isArray(input)?input as Record<string,unknown>:{};
 const color=(value:unknown)=>typeof value==='string'&&/^#[a-f0-9]{6}$/i.test(value)?value:'#c4b5fd';
 return {appTheme:data.appTheme==='light'?'light':'black',videoResolution:renderResolutions.some(item=>item.id===data.videoResolution)?data.videoResolution as RenderResolutionId:'1080p',videoPreset:motionPresets.some(item=>item.id===data.videoPreset)?data.videoPreset as MotionPresetId:'mosaic',websiteTheme:data.websiteTheme==='light'?'light':'dark',websiteAccent:color(data.websiteAccent),blogStyle:typeof data.blogStyle==='string'&&['corporate','personal','magazine'].includes(data.blogStyle)?data.blogStyle as ProductionSettings['blogStyle']:'corporate',blogAccent:color(data.blogAccent)};
}
export function loadProductionSettings():ProductionSettings{
 try{return normalizeProductionSettings(JSON.parse(localStorage.getItem(PRODUCTION_SETTINGS_KEY)||'null'));}catch{return {...DEFAULT_PRODUCTION_SETTINGS};}
}
export function saveProductionSettings(value:ProductionSettings){const normalized=normalizeProductionSettings(value);localStorage.setItem(PRODUCTION_SETTINGS_KEY,JSON.stringify(normalized));if(typeof window!=='undefined')window.dispatchEvent(new Event('production-settings-changed'));return normalized;}
